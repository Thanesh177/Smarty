variable "tables" {
  type = map(object({
    hash_key  = string
    range_key = optional(string)
  }))
}

resource "aws_dynamodb_table" "this" {
  for_each = var.tables

  name         = each.key
  billing_mode = "PAY_PER_REQUEST"

  hash_key  = each.value.hash_key
  range_key = try(each.value.range_key, null)

  attribute {
    name = each.value.hash_key
    type = "S"
  }

  dynamic "attribute" {
    for_each = try(each.value.range_key, null) == null ? [] : [each.value.range_key]

    content {
      name = attribute.value
      type = "S"
    }
  }

  point_in_time_recovery {
    enabled = true
  }

  deletion_protection_enabled = true

  lifecycle {
    prevent_destroy = true
  }
}