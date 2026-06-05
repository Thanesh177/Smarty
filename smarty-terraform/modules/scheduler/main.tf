resource "aws_scheduler_schedule" "this" {
  for_each = var.schedules

  name       = each.key
  group_name = "default"
  state      = "ENABLED"

  schedule_expression          = each.value.schedule_expression
  schedule_expression_timezone = each.value.schedule_expression_timezone

  flexible_time_window {
    mode                      = "FLEXIBLE"
    maximum_window_in_minutes = 30
  }

  target {
    arn      = each.value.target_arn
    role_arn = each.value.role_arn

    retry_policy {
      maximum_event_age_in_seconds = 86400
      maximum_retry_attempts       = 0
    }
  }

  lifecycle {
    prevent_destroy = true
  }
}
