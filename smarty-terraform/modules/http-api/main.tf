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

resource "aws_apigatewayv2_api" "this" {
  name          = var.api_name
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = var.cors_configuration.allow_origins
    allow_methods = var.cors_configuration.allow_methods
    allow_headers = var.cors_configuration.allow_headers

    expose_headers = var.cors_configuration.expose_headers

    max_age           = var.cors_configuration.max_age
    allow_credentials = var.cors_configuration.allow_credentials
  }
}


resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "$default"
  auto_deploy = true

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      access_log_settings,
      default_route_settings,
      route_settings,
      deployment_id,
      stage_variables
    ]
  }
}


resource "aws_apigatewayv2_authorizer" "jwt" {
  api_id           = aws_apigatewayv2_api.main.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "jwt-authorizer"

  jwt_configuration {
    audience = [
      "lc4jps1j0l6l834msn6eqs5t5"
    ]

    issuer = "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_URSwWqOEO"
  }

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      name,
      identity_sources,
      jwt_configuration
    ]
  }
}