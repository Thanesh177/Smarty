variable "api_name" {
  type = string
}

variable "post_glossary_api_function_arn" {
  description = "API function ARN from the isolated post-vocabulary stack. Empty keeps the new routes disabled."
  type        = string
  default     = ""
  validation {
    condition     = var.post_glossary_api_function_arn == "" || can(regex("^arn:aws[a-z-]*:lambda:[a-z0-9-]+:[0-9]{12}:function:[A-Za-z0-9_-]+(:[A-Za-z0-9_-]+)?$", var.post_glossary_api_function_arn))
    error_message = "Provide a Lambda function ARN from the post-vocabulary stack, or leave empty."
  }
}

variable "cors_configuration" {
  description = "CORS configuration for the HTTP API"

  type = object({
    allow_origins     = list(string)
    allow_methods     = list(string)
    allow_headers     = list(string)
    expose_headers    = optional(list(string), [])
    max_age           = optional(number, 86400)
    allow_credentials = optional(bool, false)
  })

  default = {
    allow_origins     = ["*"]
    allow_methods     = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    allow_headers     = ["authorization", "content-type"]
    expose_headers    = []
    max_age           = 86400
    allow_credentials = false
  }
}
