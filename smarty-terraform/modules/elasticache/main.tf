resource "aws_security_group" "redis" {
  name        = "${var.name}-redis-sg"
  description = "Allow Redis access from EKS chat service"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Redis from EKS"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = var.allowed_security_group_ids
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.name}-redis-sg"
  }
}

resource "aws_elasticache_subnet_group" "redis" {
  name       = "${var.name}-redis-subnet-group"
  subnet_ids = var.subnet_ids
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "${var.name}-redis"
  description          = "Smarty production Redis for chat service"

  engine               = "redis"
  engine_version       = "7.1"
  node_type            = "cache.t4g.micro"

  port                 = 6379
  parameter_group_name = "default.redis7"

  subnet_group_name  = aws_elasticache_subnet_group.redis.name
  security_group_ids = [aws_security_group.redis.id]

  automatic_failover_enabled = false
  multi_az_enabled           = false
  num_cache_clusters         = 1

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  apply_immediately = true

  lifecycle {
    prevent_destroy = true
  }
}
