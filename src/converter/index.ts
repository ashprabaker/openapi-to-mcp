import { OpenAPIV3 } from 'openapi-types';
import { z } from 'zod';
import { validateOpenAPISpec } from '../openapi/loader.js';

interface OpenAPIOperation {
  path: string;
  method: string;
  operation: OpenAPIV3.OperationObject;
  operationId: string;
}

export class OpenAPIToMCPConverter {
  private spec: OpenAPIV3.Document;
  private operations: OpenAPIOperation[] = [];

  constructor(spec: OpenAPIV3.Document) {
    if (!validateOpenAPISpec(spec)) {
      throw new Error('Invalid OpenAPI specification');
    }
    this.spec = spec;
    this.parseOperations();
  }

  /**
   * Parse all operations from the OpenAPI spec
   */
  private parseOperations(): void {
    const paths = this.spec.paths;
    if (!paths) return;

    // Iterate through all paths
    Object.entries(paths).forEach(([path, pathItem]) => {
      if (!pathItem) return;

      // Iterate through all methods (get, post, put, etc.)
      Object.entries(pathItem).forEach(([method, operation]) => {
        // Skip non-HTTP method properties
        if (!['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].includes(method)) {
          return;
        }

        const operationObj = operation as OpenAPIV3.OperationObject;
        
        // Generate an operationId if not present
        const operationId = operationObj.operationId || 
          `${method.toUpperCase()}_${path.replace(/[^\w\s]/g, '_')}`;

        this.operations.push({
          path,
          method,
          operation: operationObj,
          operationId,
        });
      });
    });
  }

  /**
   * Convert parameter schemas to Zod schemas
   */
  private convertParameterToZodSchema(param: OpenAPIV3.ParameterObject): { name: string; schema: any } {
    const name = param.name;
    const schema = param.schema as OpenAPIV3.SchemaObject;
    
    let zodSchema: any;
    
    // Create different schemas based on parameter type
    switch (schema.type) {
      case 'string':
        zodSchema = z.string();
        if (schema.enum) {
          zodSchema = z.enum(schema.enum as [string, ...string[]]);
        }
        if (schema.format === 'date-time') {
          zodSchema = z.string().datetime();
        }
        break;
      case 'number':
        zodSchema = z.number();
        break;
      case 'integer':
        zodSchema = z.number().int();
        break;
      case 'boolean':
        zodSchema = z.boolean();
        break;
      case 'array':
        const itemSchema = schema.items as OpenAPIV3.SchemaObject;
        if (itemSchema.type === 'string') {
          zodSchema = z.array(z.string());
        } else if (itemSchema.type === 'number') {
          zodSchema = z.array(z.number());
        } else if (itemSchema.type === 'integer') {
          zodSchema = z.array(z.number().int());
        } else if (itemSchema.type === 'boolean') {
          zodSchema = z.array(z.boolean());
        } else {
          zodSchema = z.array(z.any());
        }
        break;
      case 'object':
        zodSchema = z.object({});
        break;
      default:
        zodSchema = z.any();
    }
    
    // Add required validation
    if (!param.required) {
      zodSchema = zodSchema.optional();
    }
    
    return { name, schema: zodSchema };
  }

  /**
   * Convert OpenAPI operation to MCP tool
   */
  private convertOperationToMCPTool(operation: OpenAPIOperation) {
    const { path, method, operation: op, operationId } = operation;
    
    // Parse parameters
    const parameters = [
      ...(op.parameters || []) as OpenAPIV3.ParameterObject[],
    ];
    
    // Create a schema object for the parameters
    const paramSchemas: Record<string, any> = {};
    const paramDescriptions: Record<string, string> = {};
    
    parameters.forEach(param => {
      const { name, schema } = this.convertParameterToZodSchema(param);
      paramSchemas[name] = schema;
      
      // Store parameter description if available
      if (param.description) {
        paramDescriptions[name] = param.description;
      }
    });
    
    // Handle request body if present
    const requestBody = op.requestBody as OpenAPIV3.RequestBodyObject;
    if (requestBody && requestBody.content) {
      const jsonContent = requestBody.content['application/json'];
      if (jsonContent && jsonContent.schema) {
        const bodySchema = jsonContent.schema as OpenAPIV3.SchemaObject;
        
        // Add a 'body' parameter for the request body
        if (bodySchema.type === 'object' && bodySchema.properties) {
          Object.entries(bodySchema.properties).forEach(([propName, propSchema]) => {
            const isRequired = bodySchema.required?.includes(propName) || false;
            
            let zodSchema: any;
            switch ((propSchema as OpenAPIV3.SchemaObject).type) {
              case 'string':
                zodSchema = z.string();
                break;
              case 'number':
                zodSchema = z.number();
                break;
              case 'integer':
                zodSchema = z.number().int();
                break;
              case 'boolean':
                zodSchema = z.boolean();
                break;
              case 'array':
                const itemSchema = (propSchema as OpenAPIV3.ArraySchemaObject).items as OpenAPIV3.SchemaObject;
                if (itemSchema.type === 'string') {
                  zodSchema = z.array(z.string());
                } else if (itemSchema.type === 'number') {
                  zodSchema = z.array(z.number());
                } else if (itemSchema.type === 'integer') {
                  zodSchema = z.array(z.number().int());
                } else if (itemSchema.type === 'boolean') {
                  zodSchema = z.array(z.boolean());
                } else if ('$ref' in itemSchema && itemSchema.$ref) {
                  // Handle references for array items
                  zodSchema = z.array(z.any());
                } else {
                  zodSchema = z.array(z.any());
                }
                break;
              case 'object':
                zodSchema = z.object({}).passthrough();
                break;
              default:
                zodSchema = z.any();
            }
            
            if (!isRequired) {
              zodSchema = zodSchema.optional();
            }
            
            paramSchemas[propName] = zodSchema;
            
            // Store property description if available
            if ((propSchema as OpenAPIV3.SchemaObject).description) {
              paramDescriptions[propName] = (propSchema as OpenAPIV3.SchemaObject).description as string;
            }
          });
        } else if ('$ref' in bodySchema && bodySchema.$ref) {
          // Handle reference schemas
          // For now, we'll just use a passthrough object
          paramSchemas['body'] = z.object({}).passthrough();
          paramDescriptions['body'] = 'Request body';
        } else if (bodySchema.type === 'array') {
          // Handle array request body
          paramSchemas['body'] = z.array(z.any());
          paramDescriptions['body'] = 'Array of items';
        }
      }
    }
    
    // Generate a more detailed description that includes parameter descriptions
    let detailedDescription = op.summary || op.description || `${method.toUpperCase()} ${path}`;
    
    // Add the detailed description from the operation if available
    if (op.description && op.summary && op.description !== op.summary) {
      detailedDescription += `\n\n${op.description}`;
    }
    
    // Add parameter descriptions if available
    if (Object.keys(paramDescriptions).length > 0) {
      detailedDescription += '\n\nParameters:';
      for (const [paramName, paramDescription] of Object.entries(paramDescriptions)) {
        detailedDescription += `\n- ${paramName}: ${paramDescription}`;
      }
    }
    
    // Include details about required parameters
    const requiredParams = op.parameters?.filter(p => (p as OpenAPIV3.ParameterObject).required) || [];
    if (requestBody && (requestBody as OpenAPIV3.RequestBodyObject).required) {
      const bodySchema = ((requestBody as OpenAPIV3.RequestBodyObject).content?.['application/json']?.schema as OpenAPIV3.SchemaObject);
      if (bodySchema?.required?.length) {
        detailedDescription += '\n\nRequired fields: ' + bodySchema.required.join(', ');
      }
    }
    
    return {
      name: operationId,
      description: detailedDescription,
      parameters: paramSchemas,
      path,
      method,
    };
  }

  /**
   * Convert all OpenAPI operations to MCP tools
   */
  convertToMCPTools() {
    const tools: Record<string, any> = {};
    const openApiLookup: Record<string, OpenAPIOperation> = {};
    
    this.operations.forEach(operation => {
      const tool = this.convertOperationToMCPTool(operation);
      tools[tool.name] = {
        description: tool.description,
        parameters: tool.parameters,
        path: tool.path,
        method: tool.method,
      };
      openApiLookup[tool.name] = operation;
    });
    
    return { tools, openApiLookup };
  }
} 