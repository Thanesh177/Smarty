resource "aws_apigatewayv2_api" "main" {
  name          = var.api_name
  protocol_type = "HTTP"

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      cors_configuration,
      route_selection_expression,
      disable_execute_api_endpoint,
      body
    ]
  }
}