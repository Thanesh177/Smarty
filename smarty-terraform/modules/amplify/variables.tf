variable "app_name" {
  type = string
}

variable "repository" {
  type = string
}

variable "branch_name" {
  type = string
}

variable "environment_variables" {
  type = map(string)
}