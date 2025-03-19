import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { OpenAPIV3 } from 'openapi-types';
import FormData from 'form-data';

interface HttpClientOptions {
  baseUrl?: string;
  headers?: Record<string, string>;
  apiKey?: string;
}

export class HttpClient {
  private client: AxiosInstance;
  private openApiSpec: OpenAPIV3.Document;
  private baseUrl: string;
  private apiKey?: string;
  private apiKeyParamName?: string;
  private apiKeyLocation?: string;

  constructor(options: HttpClientOptions, openApiSpec: OpenAPIV3.Document) {
    this.openApiSpec = openApiSpec;
    this.apiKey = options.apiKey;
    
    // Extract base URL from the OpenAPI spec if not provided in options
    this.baseUrl = options.baseUrl || this.getBaseUrlFromSpec();
    
    // Extract API key parameter info if available
    this.extractApiKeyInfo();
    
    // Create headers with content type and any provided headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };
    
    // Add API key to headers if it's supposed to be in the header
    if (this.apiKey && this.apiKeyParamName && this.apiKeyLocation === 'header' 
        && !headers[this.apiKeyParamName]) {
      headers[this.apiKeyParamName] = this.apiKey;
    }
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers
    });
  }

  /**
   * Extract API key information from the security schemes
   */
  private extractApiKeyInfo(): void {
    const securitySchemes = this.openApiSpec.components?.securitySchemes;
    if (!securitySchemes) return;
    
    for (const [_, scheme] of Object.entries(securitySchemes)) {
      const securityScheme = scheme as OpenAPIV3.SecuritySchemeObject;
      
      if (securityScheme.type === 'apiKey') {
        this.apiKeyParamName = securityScheme.name;
        this.apiKeyLocation = securityScheme.in;
        break;
      } else if (securityScheme.type === 'http' && securityScheme.scheme === 'bearer') {
        this.apiKeyParamName = 'Authorization';
        this.apiKeyLocation = 'header';
        // Don't break here as there might be an apiKey scheme which takes precedence
      }
    }
  }

  /**
   * Extract the base URL from the OpenAPI spec
   */
  private getBaseUrlFromSpec(): string {
    if (this.openApiSpec.servers && this.openApiSpec.servers.length > 0) {
      const server = this.openApiSpec.servers[0];
      return server.url;
    }
    return '';
  }

  /**
   * Replace path parameters in the URL
   */
  private replacePathParams(path: string, params: Record<string, any>): string {
    return path.replace(/{([^}]+)}/g, (_, paramName) => {
      return encodeURIComponent(params[paramName] || '');
    });
  }

  /**
   * Extract query parameters from the parameters object
   */
  private extractQueryParams(params: Record<string, any>, operation: OpenAPIV3.OperationObject): Record<string, any> {
    const queryParams: Record<string, any> = {};
    
    if (!operation.parameters) return queryParams;
    
    const queryParameters = (operation.parameters as OpenAPIV3.ParameterObject[])
      .filter(param => param.in === 'query');
    
    queryParameters.forEach(param => {
      if (params[param.name] !== undefined) {
        queryParams[param.name] = params[param.name];
      }
    });
    
    // Add API key as query parameter if necessary
    if (this.apiKey && this.apiKeyParamName && this.apiKeyLocation === 'query') {
      queryParams[this.apiKeyParamName] = this.apiKey;
    }
    
    return queryParams;
  }

  /**
   * Extract request body from the parameters
   */
  private extractRequestBody(params: Record<string, any>, operation: OpenAPIV3.OperationObject): Record<string, any> | null {
    if (!operation.requestBody) return null;
    
    const requestBody = operation.requestBody as OpenAPIV3.RequestBodyObject;
    if (!requestBody.content || !requestBody.content['application/json']) return null;
    
    const jsonContent = requestBody.content['application/json'];
    if (!jsonContent.schema) return null;
    
    const schema = jsonContent.schema as OpenAPIV3.SchemaObject;
    
    // Handle array request body
    if (schema.type === 'array') {
      if (params.body && Array.isArray(params.body)) {
        return params.body;
      }
      return [];
    }
    
    // Handle object request body
    if (schema.type === 'object' || ('$ref' in schema && schema.$ref)) {
      const body: Record<string, any> = {};
      
      // If it's a referenced schema or doesn't have properties, just pass all params
      if (('$ref' in schema && schema.$ref) || !schema.properties) {
        // Filter out undefined and empty string values
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== '') {
            // Handle arrays that might come as strings
            if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
              try {
                body[key] = JSON.parse(value);
              } catch (e) {
                body[key] = value; // Keep as string if parsing fails
              }
            } else {
              body[key] = value;
            }
          }
        });
        return body;
      }
      
      // Process according to schema properties
      Object.entries(schema.properties || {}).forEach(([propName, propSchema]) => {
        if (params[propName] !== undefined) {
          const schemaObj = propSchema as OpenAPIV3.SchemaObject;
          
          // Handle array properties that might come in as strings
          if (schemaObj.type === 'array' && typeof params[propName] === 'string') {
            try {
              // Try to parse if it looks like JSON array
              if (params[propName].startsWith('[') && params[propName].endsWith(']')) {
                body[propName] = JSON.parse(params[propName]);
              } else {
                // Handle comma-separated values
                body[propName] = params[propName].split(',').map(item => item.trim());
              }
            } catch (e) {
              // If parsing fails, use as a single-item array
              body[propName] = [params[propName]];
            }
          } else {
            body[propName] = params[propName];
          }
        }
      });
      
      return body;
    }
    
    return null;
  }

  /**
   * Execute an OpenAPI operation with the given parameters
   */
  async executeOperation(
    operation: { path: string; method: string; operation: OpenAPIV3.OperationObject },
    params: Record<string, any>
  ) {
    const { path, method, operation: op } = operation;
    
    // Replace path parameters
    const url = this.replacePathParams(path, params);
    
    // Extract query parameters
    const queryParams = this.extractQueryParams(params, op);
    
    // Check if params are nested inside a body object (common with some APIs)
    const actualParams = params.body && typeof params.body === 'object' ? params.body : params;
    
    // Extract request body
    let requestBody = this.extractRequestBody(actualParams, op);
    
    // For debugging
    console.error('Request URL:', this.baseUrl + url);
    console.error('Request Method:', method);
    console.error('Request Body:', JSON.stringify(requestBody, null, 2));
    
    // Handle special cases for specific content types
    let contentType = 'application/json';
    let data = requestBody;
    
    // Check if this is a multi-part form data request
    if (op.requestBody) {
      const requestBodyObj = op.requestBody as OpenAPIV3.RequestBodyObject;
      if (requestBodyObj.content && requestBodyObj.content['multipart/form-data']) {
        contentType = 'multipart/form-data';
        
        // Create FormData object for multipart requests
        const formData = new FormData();
        if (requestBody) {
          Object.entries(requestBody).forEach(([key, value]) => {
            if (value !== undefined) {
              formData.append(key, value as any);
            }
          });
        }
        data = formData;
      }
    }
    
    // Handle array request bodies correctly
    if (op.requestBody) {
      const requestBodyObj = op.requestBody as OpenAPIV3.RequestBodyObject;
      if (requestBodyObj.content?.['application/json']?.schema) {
        const schema = requestBodyObj.content['application/json'].schema as OpenAPIV3.SchemaObject;
        if (schema.type === 'array' && Array.isArray(actualParams.body)) {
          data = actualParams.body;
        }
      }
    }
    
    // Set up request configuration
    const config: AxiosRequestConfig = {
      method: method,
      url,
      params: queryParams,
      data,
      headers: {
        'Content-Type': contentType
      }
    };
    
    try {
      const response = await this.client.request(config);
      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          console.error('Error Response:', error.response.data);
          throw new Error(`API request failed with status ${error.response.status}: ${JSON.stringify(error.response.data)}`);
        } else if (error.request) {
          // The request was made but no response was received
          throw new Error(`API request failed: No response received from server`);
        } else {
          // Something happened in setting up the request that triggered an Error
          throw new Error(`API request failed: ${error.message}`);
        }
      }
      throw error;
    }
  }
} 