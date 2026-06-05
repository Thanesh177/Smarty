resource "aws_lambda_function" "this" {
  for_each = var.functions

  function_name = each.key
  runtime       = each.value.runtime
  handler       = each.value.handler
  role          = each.value.role_arn

  filename = each.value.filename

  timeout     = each.value.timeout
  memory_size = each.value.memory_size

  dynamic "environment" {
    for_each = length(each.value.environment) == 0 ? [] : [1]

    content {
      variables = each.value.environment
    }
  }

lifecycle {
  prevent_destroy = true

  ignore_changes = [
    filename,
    source_code_hash,
    s3_bucket,
    s3_key,
    image_uri,
    environment,
    role,
    runtime,
    handler,
    timeout,
    memory_size,
    layers,
    description,
    publish,
    architectures,
    ephemeral_storage,
    tracing_config,
    logging_config
  ]
}
}
