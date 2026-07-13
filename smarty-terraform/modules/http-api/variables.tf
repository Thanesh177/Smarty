variable "api_name" {
  type = string
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