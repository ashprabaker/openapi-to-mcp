import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { OpenAPIV3 } from 'openapi-types';

interface HttpClientOptions {
  baseUrl?: string;
  headers?: Record<string, string>;
}

export class HttpClient {
  private client: AxiosInstance;
  private openApiSpec: OpenAPIV3.Document;
  private baseUrl: string;

  constructor(options: HttpClientOptions, openApiSpec: OpenAPIV3.Document) {
    this.openApiSpec = openApiSpec;
    
    // Extract base URL from the OpenAPI spec if not provided in options
    this.baseUrl = options.baseUrl || this.getBaseUrlFromSpec();
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
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
    if (schema.type !== 'object' || !schema.properties) return null;
    
    const body: Record<string, any> = {};
    
    Object.keys(schema.properties).forEach(propName => {
      if (params[propName] !== undefined) {
        body[propName] = params[propName];
      }
    });
    
    return body;
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
    
    // Extract request body
    const requestBody = this.extractRequestBody(params, op);
    
    const config: AxiosRequestConfig = {
      method: method,
      url,
      params: queryParams,
      data: requestBody,
    };
    
    try {
      const response = await this.client.request(config);
      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw new Error(`API request failed: ${error.message}`);
      }
      throw error;
    }
  }
} 