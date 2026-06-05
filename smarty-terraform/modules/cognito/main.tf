resource "aws_cognito_user_pool" "main" {
  name = var.user_pool_name

  lifecycle {
    prevent_destroy = true

    ignore_changes = all
  }
}

resource "aws_cognito_user_pool_client" "smarty" {
  name         = "Smarty"
  user_pool_id = aws_cognito_user_pool.main.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = all
  }
}