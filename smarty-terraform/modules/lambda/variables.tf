variable "functions" {
  type = map(object({
    runtime     = string
    handler     = string
    timeout     = number
    memory_size = number
    role_arn    = string
    filename    = string
    environment = map(string)
  }))
}
