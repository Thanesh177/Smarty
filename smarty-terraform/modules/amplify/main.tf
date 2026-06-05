resource "aws_amplify_app" "this" {
  name       = var.app_name
  repository = var.repository



  platform = "WEB"

  environment_variables = var.environment_variables

  custom_rule {
    source = "/<*>"
    target = "/index.html"
    status = "404-200"
 }

  build_spec = <<-EOT
    version: 1
    frontend:
      phases:
        preBuild:
          commands:
            - npm ci
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: dist
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
  EOT

  lifecycle {
  prevent_destroy = true

  ignore_changes = [
    build_spec,
    repository,
    environment_variables
  ]
}
}

resource "aws_amplify_branch" "main" {
  app_id      = aws_amplify_app.this.id
  branch_name = var.branch_name

  stage = "PRODUCTION"

  enable_auto_build = true

  lifecycle {
    prevent_destroy = true
  }
}