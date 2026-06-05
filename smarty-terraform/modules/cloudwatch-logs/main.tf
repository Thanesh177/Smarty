resource "aws_cloudwatch_log_group" "this" {
  for_each = var.log_groups

  name              = each.value
  retention_in_days = var.retention_days

  lifecycle {
    prevent_destroy = true
  }
}
