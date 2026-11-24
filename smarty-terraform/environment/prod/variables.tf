variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "environment" {
  type    = string
  default = "prod"
}

variable "post_glossary_api_function_arn" {
  description = "GlossaryApiArn output from the reviewed post-vocabulary stack. Empty leaves the new API disabled."
  type        = string
  default     = ""
}
