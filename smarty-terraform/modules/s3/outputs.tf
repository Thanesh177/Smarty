output "bucket_names" {
  value = {
    for key, bucket in aws_s3_bucket.this : key => bucket.bucket
  }
}