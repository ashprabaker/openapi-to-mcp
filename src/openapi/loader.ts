import { OpenAPIV3 } from 'openapi-types';
import fs from 'fs/promises';
import axios from 'axios';
import yaml from 'js-yaml';

/**
 * Loads an OpenAPI specification from a file path or URL
 */
export async function loadOpenAPISpec(specPath: string): Promise<OpenAPIV3.Document> {
  let content: string;
  
  // Handle URL vs file path loading
  if (specPath.startsWith('http://') || specPath.startsWith('https://')) {
    try {
      const response = await axios.get(specPath);
      content = typeof response.data === 'string' 
        ? response.data
        : JSON.stringify(response.data);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to fetch OpenAPI spec from URL: ${error.message}`);
      }
      throw error;
    }
  } else {
    try {
      content = await fs.readFile(specPath, 'utf-8');
    } catch (error: unknown) {
      throw new Error(`Failed to read OpenAPI spec file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Parse the content based on file extension
  try {
    if (specPath.endsWith('.yaml') || specPath.endsWith('.yml')) {
      return yaml.load(content) as OpenAPIV3.Document;
    } else {
      return JSON.parse(content) as OpenAPIV3.Document;
    }
  } catch (error: unknown) {
    throw new Error(`Failed to parse OpenAPI spec: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Validates that the loaded document is a valid OpenAPI spec
 */
export function validateOpenAPISpec(spec: any): spec is OpenAPIV3.Document {
  if (!spec) {
    throw new Error('OpenAPI spec is undefined or null');
  }
  
  if (typeof spec !== 'object') {
    throw new Error('OpenAPI spec must be an object');
  }
  
  // Check for required OpenAPI fields
  if (!spec.openapi) {
    throw new Error('Missing "openapi" field in spec');
  }
  
  if (!spec.info) {
    throw new Error('Missing "info" field in spec');
  }
  
  if (!spec.paths) {
    throw new Error('Missing "paths" field in spec');
  }
  
  return true;
} 