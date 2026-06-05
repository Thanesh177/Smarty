variable "schedules" {
  type = map(object({
    schedule_expression          = string
    schedule_expression_timezone = string
    target_arn                   = string
    role_arn                     = string
  }))
}
