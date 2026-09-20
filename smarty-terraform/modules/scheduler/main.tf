resource "aws_scheduler_schedule" "this" {
  for_each = var.schedules

  name       = each.key
  group_name = "default"
  state      = "ENABLED"

  schedule_expression          = each.value.schedule_expression
  schedule_expression_timezone = each.value.schedule_expression_timezone

  flexible_time_window {
    mode                      = each.value.flexible_window_minutes == 0 ? "OFF" : "FLEXIBLE"
    maximum_window_in_minutes = each.value.flexible_window_minutes == 0 ? null : each.value.flexible_window_minutes
  }

  target {
    arn      = each.value.target_arn
    role_arn = each.value.role_arn
    input    = each.value.input

    retry_policy {
      maximum_event_age_in_seconds = 86400
      maximum_retry_attempts       = 0
    }
  }

  lifecycle {
    prevent_destroy = true
  }
}
