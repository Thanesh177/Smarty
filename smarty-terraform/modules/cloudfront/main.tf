resource "aws_cloudfront_distribution" "this" {
  for_each = var.distributions

  enabled         = each.value.enabled
  is_ipv6_enabled = each.value.is_ipv6_enabled
  comment         = each.value.comment
  price_class     = "PriceClass_All"
  web_acl_id      = each.value.web_acl_id

  tags = {
    Name = each.value.name_tag
  }

  origin {
    domain_name              = each.value.origin_domain_name
    origin_id                = each.value.origin_id
    origin_access_control_id = each.value.oac_id

    s3_origin_config {
      origin_access_identity = ""
    }
  }

  default_cache_behavior {
    target_origin_id       = each.value.origin_id
    viewer_protocol_policy = "redirect-to-https"
    cache_policy_id        = "658327ea-f89d-4fab-a63d-7e88639e58f6"
    compress               = true

    allowed_methods = ["GET", "HEAD"]
    cached_methods  = ["GET", "HEAD"]
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      aliases,
      default_cache_behavior,
      ordered_cache_behavior,
      origin,
      origin_group,
      custom_error_response,
      viewer_certificate,
      restrictions,
      web_acl_id,
      price_class,
      http_version,
      is_ipv6_enabled,
      enabled,
      comment,
      logging_config
    ]
  }
}
