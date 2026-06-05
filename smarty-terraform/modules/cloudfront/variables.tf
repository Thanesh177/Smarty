
variable "distributions" {
  type = map(object({
    enabled            = bool
    origin_domain_name = string
    origin_id          = string
    oac_id             = string
    web_acl_id         = string
    comment            = string
    is_ipv6_enabled    = bool
    name_tag           = string
  }))
}
