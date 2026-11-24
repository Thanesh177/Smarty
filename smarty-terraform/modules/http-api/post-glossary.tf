# This isolated API only enqueues work or returns status. It never calls a model
# during an HTTP request or changes the scheduled publisher's configuration.
locals {
  glossary_methods = trimspace(var.post_glossary_api_function_arn) == "" ? toset([]) : toset(["POST", "GET"])
}

resource "aws_apigatewayv2_integration" "post_glossary" {
  count                  = length(local.glossary_methods) == 0 ? 0 : 1
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = var.post_glossary_api_function_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 10000
}

resource "aws_apigatewayv2_route" "post_glossary" {
  for_each           = local.glossary_methods
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "${each.value} /posts/glossary"
  target             = "integrations/${aws_apigatewayv2_integration.post_glossary[0].id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

resource "aws_lambda_permission" "post_glossary_api" {
  for_each      = local.glossary_methods
  statement_id  = "AllowHttpApi${each.value}PostGlossary"
  action        = "lambda:InvokeFunction"
  function_name = var.post_glossary_api_function_arn
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/${each.value}/posts/glossary"
}
