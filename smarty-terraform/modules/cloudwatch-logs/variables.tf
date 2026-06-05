variable "log_groups" {
  type = set(string)
}

variable "retention_days" {
  type    = number
  default = 30
}
