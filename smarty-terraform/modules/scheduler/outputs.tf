output "schedule_names" {
  value = [for s in aws_scheduler_schedule.this : s.name]
}
