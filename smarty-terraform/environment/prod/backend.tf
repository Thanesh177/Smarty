terraform {
  backend "s3" {
    bucket       = "smarty-terraform-state-147179611217"
    key          = "smarty/prod/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}