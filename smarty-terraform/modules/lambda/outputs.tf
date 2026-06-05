output "function_names" {
  value = {
    for key, fn in aws_lambda_function.this : key => fn.function_name
  }
}

output "function_arns" {
  value = {
    for key, fn in aws_lambda_function.this : key => fn.arn
  }
}