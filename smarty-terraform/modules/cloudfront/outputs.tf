output "domain_names" {
  value = {
    for k, d in aws_cloudfront_distribution.this : k => d.domain_name
  }
}
