resource "aws_apigatewayv2_api" "main" {
  name                       = var.api_name
  protocol_type              = "WEBSOCKET"
  route_selection_expression = "$request.body.action"

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      route_selection_expression,
      api_key_selection_expression,
      disable_execute_api_endpoint,
      body
    ]
  }
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "production"
  auto_deploy = true

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      auto_deploy,
      access_log_settings,
      default_route_settings,
      route_settings,
      deployment_id,
      stage_variables
    ]
  }
}

resource "aws_apigatewayv2_integration" "connect" {
  api_id                   = aws_apigatewayv2_api.main.id
  integration_type         = "AWS_PROXY"
  integration_method       = "POST"
  integration_uri          = "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:147179611217:function:chatConnect/invocations"
  passthrough_behavior     = "WHEN_NO_MATCH"
  payload_format_version   = "1.0"
  timeout_milliseconds     = 29000
  content_handling_strategy = "CONVERT_TO_TEXT"

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      passthrough_behavior,
      payload_format_version,
      timeout_milliseconds,
      content_handling_strategy,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "connect" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "$connect"
  target             = "integrations/${aws_apigatewayv2_integration.connect.id}"
  authorization_type = "NONE"
  api_key_required   = false

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "disconnect" {
  api_id                   = aws_apigatewayv2_api.main.id
  integration_type         = "AWS_PROXY"
  integration_method       = "POST"
  integration_uri          = "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:147179611217:function:chatDisconnect/invocations"
  passthrough_behavior     = "WHEN_NO_MATCH"
  payload_format_version   = "1.0"
  timeout_milliseconds     = 29000
  content_handling_strategy = "CONVERT_TO_TEXT"

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      passthrough_behavior,
      payload_format_version,
      timeout_milliseconds,
      content_handling_strategy,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "disconnect" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "$disconnect"
  target             = "integrations/${aws_apigatewayv2_integration.disconnect.id}"
  authorization_type = "NONE"
  api_key_required   = false

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "send_message" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_method     = "POST"
  integration_uri        = "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:147179611217:function:chatSendMessage/invocations"
  passthrough_behavior   = "WHEN_NO_MATCH"
  payload_format_version = "1.0"
  timeout_milliseconds   = 29000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      passthrough_behavior,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "send_message" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "sendMessage"
  target             = "integrations/${aws_apigatewayv2_integration.send_message.id}"
  authorization_type = "NONE"
  api_key_required   = false

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "send_room_message" {
  api_id                   = aws_apigatewayv2_api.main.id
  integration_type         = "AWS_PROXY"
  integration_method       = "POST"
  integration_uri          = "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:147179611217:function:topicRoomSendMessage/invocations"
  passthrough_behavior     = "WHEN_NO_MATCH"
  payload_format_version   = "1.0"
  timeout_milliseconds     = 29000
  content_handling_strategy = "CONVERT_TO_TEXT"

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      passthrough_behavior,
      payload_format_version,
      timeout_milliseconds,
      content_handling_strategy,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "send_room_message" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "sendRoomMessage"
  target             = "integrations/${aws_apigatewayv2_integration.send_room_message.id}"
  authorization_type = "NONE"
  api_key_required   = false

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}
