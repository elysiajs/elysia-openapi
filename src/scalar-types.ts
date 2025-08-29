// Local type definitions to replace @scalar/types dependency
// This avoids the Zod v3/v4 compatibility issues

export interface ReferenceConfiguration {
  /**
   * Custom CSS to inject into the Scalar reference
   */
  customCss?: string
  
  /**
   * Specification configuration
   */
  spec?: {
    /**
     * URL to the OpenAPI specification
     */
    url?: string
  }
  
  /**
   * Additional configuration properties that might be used by Scalar
   * We keep this flexible to maintain compatibility
   */
  [key: string]: any
}
