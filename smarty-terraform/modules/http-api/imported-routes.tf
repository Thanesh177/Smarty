
resource "aws_apigatewayv2_integration" "post_comments_delete" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:deleteComment"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "post_comments_delete" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /comments/delete"
  target             = "integrations/${aws_apigatewayv2_integration.post_comments_delete.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "get_rooms_invite_invitecode" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:invite-link"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "get_rooms_invite_invitecode" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /rooms/invite/{inviteCode}"
  target             = "integrations/${aws_apigatewayv2_integration.get_rooms_invite_invitecode.id}"
  authorization_type = "NONE"
  api_key_required   = false

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "post_like" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:likeTextReel"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "post_like" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /like"
  target             = "integrations/${aws_apigatewayv2_integration.post_like.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "get_chats" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:chatRestHandler"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "get_chats" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /chats"
  target             = "integrations/${aws_apigatewayv2_integration.get_chats.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "get_bookshelves" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:MyApi"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "get_bookshelves" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /bookshelves"
  target             = "integrations/${aws_apigatewayv2_integration.get_bookshelves.id}"
  authorization_type = "NONE"
  api_key_required   = false

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "post_posts_explain" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:Explaination"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "post_posts_explain" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /posts/explain"
  target             = "integrations/${aws_apigatewayv2_integration.post_posts_explain.id}"
  authorization_type = "NONE"
  api_key_required   = false

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "get_reels" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:getTextReels"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "get_reels" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /reels"
  target             = "integrations/${aws_apigatewayv2_integration.get_reels.id}"
  authorization_type = "NONE"
  api_key_required   = false

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "post_rooms_roomid_hide" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:chatRestHandler"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "post_rooms_roomid_hide" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /rooms/{roomId}/hide"
  target             = "integrations/${aws_apigatewayv2_integration.post_rooms_roomid_hide.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "post_users_follow_requests_approve" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:chatRestHandler"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "post_users_follow_requests_approve" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /users/follow-requests/approve"
  target             = "integrations/${aws_apigatewayv2_integration.post_users_follow_requests_approve.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "post_rooms_roomid_leave" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:chatRestHandler"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "post_rooms_roomid_leave" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /rooms/{roomId}/leave"
  target             = "integrations/${aws_apigatewayv2_integration.post_rooms_roomid_leave.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "get_topics" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:getTopics"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "get_topics" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /topics"
  target             = "integrations/${aws_apigatewayv2_integration.get_topics.id}"
  authorization_type = "NONE"
  api_key_required   = false

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "post_rooms" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:CreateRoom"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "post_rooms" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /rooms"
  target             = "integrations/${aws_apigatewayv2_integration.post_rooms.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "options_users_find" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:CreateRoom"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "options_users_find" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "OPTIONS /users/find"
  target             = "integrations/${aws_apigatewayv2_integration.options_users_find.id}"
  authorization_type = "NONE"
  api_key_required   = false

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "get_savedreels" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:getSavedReels"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "get_savedreels" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /savedReels"
  target             = "integrations/${aws_apigatewayv2_integration.get_savedreels.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "get_users_block_status" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:chatRestHandler"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "get_users_block_status" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /users/block-status"
  target             = "integrations/${aws_apigatewayv2_integration.get_users_block_status.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "options_books_id_text" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:MyApi"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "options_books_id_text" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "OPTIONS /books/{id}/text"
  target             = "integrations/${aws_apigatewayv2_integration.options_books_id_text.id}"
  authorization_type = "NONE"
  api_key_required   = false

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "post_rooms_roomid_messages" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:chatRestHandler"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "post_rooms_roomid_messages" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /rooms/{roomId}/messages"
  target             = "integrations/${aws_apigatewayv2_integration.post_rooms_roomid_messages.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "post_quiz_generate" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:generateQuizQuestions"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "post_quiz_generate" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /quiz/generate"
  target             = "integrations/${aws_apigatewayv2_integration.post_quiz_generate.id}"
  authorization_type = "NONE"
  api_key_required   = false

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "get_rooms_roomid_messages" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:chatRestHandler"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "get_rooms_roomid_messages" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /rooms/{roomId}/messages"
  target             = "integrations/${aws_apigatewayv2_integration.get_rooms_roomid_messages.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "post_rooms_roomid_rename" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:Edit-room-img"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "post_rooms_roomid_rename" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /rooms/{roomId}/rename"
  target             = "integrations/${aws_apigatewayv2_integration.post_rooms_roomid_rename.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "options_books_subjects" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:MyApi"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "options_books_subjects" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "OPTIONS /books/subjects"
  target             = "integrations/${aws_apigatewayv2_integration.options_books_subjects.id}"
  authorization_type = "NONE"
  api_key_required   = false

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "post_messages_delete" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:chat-media"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "post_messages_delete" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /messages/delete"
  target             = "integrations/${aws_apigatewayv2_integration.post_messages_delete.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "get_reel" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:getReelById"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "get_reel" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /reel"
  target             = "integrations/${aws_apigatewayv2_integration.get_reel.id}"
  authorization_type = "NONE"
  api_key_required   = false

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "post_users_follow_requests_reject" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:chatRestHandler"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "post_users_follow_requests_reject" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /users/follow-requests/reject"
  target             = "integrations/${aws_apigatewayv2_integration.post_users_follow_requests_reject.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "get_books" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:MyApi"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "get_books" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /books"
  target             = "integrations/${aws_apigatewayv2_integration.get_books.id}"
  authorization_type = "NONE"
  api_key_required   = false

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "post_room_invites_invitecode_disable" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:invite-link"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "post_room_invites_invitecode_disable" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /room-invites/{inviteCode}/disable"
  target             = "integrations/${aws_apigatewayv2_integration.post_room_invites_invitecode_disable.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "delete_rooms_roomid" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:delete_room"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "delete_rooms_roomid" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "DELETE /rooms/{roomId}"
  target             = "integrations/${aws_apigatewayv2_integration.delete_rooms_roomid.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "post_media_view_url" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:chat-media"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "post_media_view_url" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /media/view-url"
  target             = "integrations/${aws_apigatewayv2_integration.post_media_view_url.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "post_posts_ask_doubt" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:AIcontent"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "post_posts_ask_doubt" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /posts/ask-doubt"
  target             = "integrations/${aws_apigatewayv2_integration.post_posts_ask_doubt.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "options_books_id" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:MyApi"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "options_books_id" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "OPTIONS /books/{id}"
  target             = "integrations/${aws_apigatewayv2_integration.options_books_id.id}"
  authorization_type = "NONE"
  api_key_required   = false

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "post_users_push_token" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:chatRestHandler"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "post_users_push_token" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /users/push-token"
  target             = "integrations/${aws_apigatewayv2_integration.post_users_push_token.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "delete_saved_posts_postid" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:likeTextReel"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "delete_saved_posts_postid" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "DELETE /saved-posts/{postId}"
  target             = "integrations/${aws_apigatewayv2_integration.delete_saved_posts_postid.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "post_rooms_roomid_members_remove" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:chatRestHandler"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "post_rooms_roomid_members_remove" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /rooms/{roomId}/members/remove"
  target             = "integrations/${aws_apigatewayv2_integration.post_rooms_roomid_members_remove.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "post_rooms_roomid_invites" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:CreateRoom"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "post_rooms_roomid_invites" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /rooms/{roomId}/invites"
  target             = "integrations/${aws_apigatewayv2_integration.post_rooms_roomid_invites.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "post_users_follow" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:chatRestHandler"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "post_users_follow" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /users/follow"
  target             = "integrations/${aws_apigatewayv2_integration.post_users_follow.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "post_rooms_roomid_invites_accept" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:CreateRoom"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "post_rooms_roomid_invites_accept" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /rooms/{roomId}/invites/accept"
  target             = "integrations/${aws_apigatewayv2_integration.post_rooms_roomid_invites_accept.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "options_room_invites_invitecode_join" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:invite-link"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "options_room_invites_invitecode_join" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "OPTIONS /room-invites/{inviteCode}/join"
  target             = "integrations/${aws_apigatewayv2_integration.options_room_invites_invitecode_join.id}"
  authorization_type = "NONE"
  api_key_required   = false

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "post_quiz_save" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:saveQuizResult"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "post_quiz_save" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /quiz/save"
  target             = "integrations/${aws_apigatewayv2_integration.post_quiz_save.id}"
  authorization_type = "NONE"
  api_key_required   = false

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "post_savereel" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:saveReel"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "post_savereel" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /saveReel"
  target             = "integrations/${aws_apigatewayv2_integration.post_savereel.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "put_comments_edit" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:editComment"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "put_comments_edit" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "PUT /comments/edit"
  target             = "integrations/${aws_apigatewayv2_integration.put_comments_edit.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "post_room_invites_invitecode_join" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:invite-link"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "post_room_invites_invitecode_join" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /room-invites/{inviteCode}/join"
  target             = "integrations/${aws_apigatewayv2_integration.post_room_invites_invitecode_join.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "options_room_invites_invitecode_disable" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:invite-link"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "options_room_invites_invitecode_disable" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "OPTIONS /room-invites/{inviteCode}/disable"
  target             = "integrations/${aws_apigatewayv2_integration.options_room_invites_invitecode_disable.id}"
  authorization_type = "NONE"
  api_key_required   = false

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "get_users_search" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:chatRestHandler"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "get_users_search" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /users/search"
  target             = "integrations/${aws_apigatewayv2_integration.get_users_search.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "post_room_images_roomid" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:Edit-room-img"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "post_room_images_roomid" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /room-images/{roomId}"
  target             = "integrations/${aws_apigatewayv2_integration.post_room_images_roomid.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "post_messages_edit" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:chat-media"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "post_messages_edit" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /messages/edit"
  target             = "integrations/${aws_apigatewayv2_integration.post_messages_edit.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "get_rooms_invites" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:CreateRoom"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "get_rooms_invites" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /rooms/invites"
  target             = "integrations/${aws_apigatewayv2_integration.get_rooms_invites.id}"
  authorization_type = "NONE"
  api_key_required   = false

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "post_posts_translate" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:translate"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "post_posts_translate" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /posts/translate"
  target             = "integrations/${aws_apigatewayv2_integration.post_posts_translate.id}"
  authorization_type = "NONE"
  api_key_required   = false

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "get_users_following" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:chatRestHandler"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "get_users_following" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /users/following"
  target             = "integrations/${aws_apigatewayv2_integration.get_users_following.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "get_comments" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:getComments"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "get_comments" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /comments"
  target             = "integrations/${aws_apigatewayv2_integration.get_comments.id}"
  authorization_type = "NONE"
  api_key_required   = false

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "get_books_subjects" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:MyApi"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "get_books_subjects" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /books/subjects"
  target             = "integrations/${aws_apigatewayv2_integration.get_books_subjects.id}"
  authorization_type = "NONE"
  api_key_required   = false

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "post_users_find" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:CreateRoom"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "post_users_find" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /users/find"
  target             = "integrations/${aws_apigatewayv2_integration.post_users_find.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "options_quiz_generate" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:generateQuizQuestions"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "options_quiz_generate" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "OPTIONS /quiz/generate"
  target             = "integrations/${aws_apigatewayv2_integration.options_quiz_generate.id}"
  authorization_type = "NONE"
  api_key_required   = false

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "post_users_report" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:chatRestHandler"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "post_users_report" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /users/report"
  target             = "integrations/${aws_apigatewayv2_integration.post_users_report.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "delete_chats_chatid" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:delete_chat"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "delete_chats_chatid" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "DELETE /chats/{chatId}"
  target             = "integrations/${aws_apigatewayv2_integration.delete_chats_chatid.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "post_createreel" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:createReel"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "post_createreel" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /createReel"
  target             = "integrations/${aws_apigatewayv2_integration.post_createreel.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "get_creator_private_posts" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:chatRestHandler"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "get_creator_private_posts" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /creator/private-posts"
  target             = "integrations/${aws_apigatewayv2_integration.get_creator_private_posts.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "get_users_follow_requests" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:chatRestHandler"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "get_users_follow_requests" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /users/follow-requests"
  target             = "integrations/${aws_apigatewayv2_integration.get_users_follow_requests.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "post_users_unfollow" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:chatRestHandler"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "post_users_unfollow" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /users/unfollow"
  target             = "integrations/${aws_apigatewayv2_integration.post_users_unfollow.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "post_rooms_roomid_unhide" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:chatRestHandler"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "post_rooms_roomid_unhide" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /rooms/{roomId}/unhide"
  target             = "integrations/${aws_apigatewayv2_integration.post_rooms_roomid_unhide.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "post_rooms_roomid_media_upload_url" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:Topic_media"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "post_rooms_roomid_media_upload_url" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /rooms/{roomId}/media-upload-url"
  target             = "integrations/${aws_apigatewayv2_integration.post_rooms_roomid_media_upload_url.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "post_users_unblock" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:chatRestHandler"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "post_users_unblock" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /users/unblock"
  target             = "integrations/${aws_apigatewayv2_integration.post_users_unblock.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "get_rooms_roomid_members" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:chatRestHandler"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "get_rooms_roomid_members" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /rooms/{roomId}/members"
  target             = "integrations/${aws_apigatewayv2_integration.get_rooms_roomid_members.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "post_updatereel" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:updateReel"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "post_updatereel" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /updateReel"
  target             = "integrations/${aws_apigatewayv2_integration.post_updatereel.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "post_rooms_roomid_invite_link" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:invite-link"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "post_rooms_roomid_invite_link" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /rooms/{roomId}/invite-link"
  target             = "integrations/${aws_apigatewayv2_integration.post_rooms_roomid_invite_link.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "get_rooms_hidden" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:chatRestHandler"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "get_rooms_hidden" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /rooms/hidden"
  target             = "integrations/${aws_apigatewayv2_integration.get_rooms_hidden.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "options_room_invites_invitecode" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:invite-link"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "options_room_invites_invitecode" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "OPTIONS /room-invites/{inviteCode}"
  target             = "integrations/${aws_apigatewayv2_integration.options_room_invites_invitecode.id}"
  authorization_type = "NONE"
  api_key_required   = false

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "get_rooms" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:chatRestHandler"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "get_rooms" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /rooms"
  target             = "integrations/${aws_apigatewayv2_integration.get_rooms.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "post_chats_read" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:chatRestHandler"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "post_chats_read" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /chats/read"
  target             = "integrations/${aws_apigatewayv2_integration.post_chats_read.id}"
  authorization_type = "NONE"
  api_key_required   = false

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "options_rooms_roomid_rename" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:Edit-room-img"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "options_rooms_roomid_rename" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "OPTIONS /rooms/{roomId}/rename"
  target             = "integrations/${aws_apigatewayv2_integration.options_rooms_roomid_rename.id}"
  authorization_type = "NONE"
  api_key_required   = false

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "get_books_id" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:MyApi"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "get_books_id" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /books/{id}"
  target             = "integrations/${aws_apigatewayv2_integration.get_books_id.id}"
  authorization_type = "NONE"
  api_key_required   = false

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "post_rooms_roomid_invite" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:CreateRoom"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "post_rooms_roomid_invite" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /rooms/{roomId}/invite"
  target             = "integrations/${aws_apigatewayv2_integration.post_rooms_roomid_invite.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "get_users_followers" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:chatRestHandler"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "get_users_followers" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /users/followers"
  target             = "integrations/${aws_apigatewayv2_integration.get_users_followers.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "get_myreels" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:getMyReels"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "get_myreels" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /myReels"
  target             = "integrations/${aws_apigatewayv2_integration.get_myreels.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "post_posts_details" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:AIcontent"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "post_posts_details" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /posts/details"
  target             = "integrations/${aws_apigatewayv2_integration.post_posts_details.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "get_room_invites_invitecode" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:invite-link"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "get_room_invites_invitecode" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /room-invites/{inviteCode}"
  target             = "integrations/${aws_apigatewayv2_integration.get_room_invites_invitecode.id}"
  authorization_type = "NONE"
  api_key_required   = false

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "post_rooms_roomid_request" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:chatRestHandler"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "post_rooms_roomid_request" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /rooms/{roomId}/request"
  target             = "integrations/${aws_apigatewayv2_integration.post_rooms_roomid_request.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "get_users_profile" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:updateUserProfile"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "get_users_profile" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /users/profile"
  target             = "integrations/${aws_apigatewayv2_integration.get_users_profile.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "options_rooms_roomid_members_remove" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:chatRestHandler"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "options_rooms_roomid_members_remove" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "OPTIONS /rooms/{roomId}/members/remove"
  target             = "integrations/${aws_apigatewayv2_integration.options_rooms_roomid_members_remove.id}"
  authorization_type = "NONE"
  api_key_required   = false

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "delete_rooms_roomid_messages_messageid" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:invite-link"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "delete_rooms_roomid_messages_messageid" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "DELETE /rooms/{roomId}/messages/{messageId}"
  target             = "integrations/${aws_apigatewayv2_integration.delete_rooms_roomid_messages_messageid.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "post_chats_message" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:chatRestHandler"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "post_chats_message" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /chats/message"
  target             = "integrations/${aws_apigatewayv2_integration.post_chats_message.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "options_room_images_roomid" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:Edit-room-img"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "options_room_images_roomid" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "OPTIONS /room-images/{roomId}"
  target             = "integrations/${aws_apigatewayv2_integration.options_room_images_roomid.id}"
  authorization_type = "NONE"
  api_key_required   = false

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "get_chats_messages" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:chatRestHandler"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "get_chats_messages" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /chats/messages"
  target             = "integrations/${aws_apigatewayv2_integration.get_chats_messages.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "options_rooms_roomid_invite_link" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:invite-link"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "options_rooms_roomid_invite_link" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "OPTIONS /rooms/{roomId}/invite-link"
  target             = "integrations/${aws_apigatewayv2_integration.options_rooms_roomid_invite_link.id}"
  authorization_type = "NONE"
  api_key_required   = false

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "get_rooms_roomid_requests" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:chatRestHandler"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "get_rooms_roomid_requests" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /rooms/{roomId}/requests"
  target             = "integrations/${aws_apigatewayv2_integration.get_rooms_roomid_requests.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "post_getuploadurl" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:getUploadUrl"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "post_getuploadurl" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /getUploadUrl"
  target             = "integrations/${aws_apigatewayv2_integration.post_getuploadurl.id}"
  authorization_type = "NONE"
  api_key_required   = false

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "options_users_profile" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:updateUserProfile"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "options_users_profile" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "OPTIONS /users/profile"
  target             = "integrations/${aws_apigatewayv2_integration.options_users_profile.id}"
  authorization_type = "NONE"
  api_key_required   = false

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "post_comment" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:addComment"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "post_comment" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /comment"
  target             = "integrations/${aws_apigatewayv2_integration.post_comment.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "get_latest" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:news"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "get_latest" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /latest"
  target             = "integrations/${aws_apigatewayv2_integration.get_latest.id}"
  authorization_type = "NONE"
  api_key_required   = false

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "options_bookshelves" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:MyApi"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "options_bookshelves" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "OPTIONS /bookshelves"
  target             = "integrations/${aws_apigatewayv2_integration.options_bookshelves.id}"
  authorization_type = "NONE"
  api_key_required   = false

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "post_messages_react" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:chat-media"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "post_messages_react" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /messages/react"
  target             = "integrations/${aws_apigatewayv2_integration.post_messages_react.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "post_rooms_invite_link" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:invite-link"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "post_rooms_invite_link" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /rooms/invite-link"
  target             = "integrations/${aws_apigatewayv2_integration.post_rooms_invite_link.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "put_users_profile" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:updateUserProfile"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "put_users_profile" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "PUT /users/profile"
  target             = "integrations/${aws_apigatewayv2_integration.put_users_profile.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "post_users_block" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:chatRestHandler"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "post_users_block" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /users/block"
  target             = "integrations/${aws_apigatewayv2_integration.post_users_block.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "post_media_upload_url" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:chat-media"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "post_media_upload_url" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /media/upload-url"
  target             = "integrations/${aws_apigatewayv2_integration.post_media_upload_url.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "options_rooms" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:CreateRoom"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "options_rooms" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "OPTIONS /rooms"
  target             = "integrations/${aws_apigatewayv2_integration.options_rooms.id}"
  authorization_type = "NONE"
  api_key_required   = false

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "post_deletereel" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:deleteReel"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "post_deletereel" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /deleteReel"
  target             = "integrations/${aws_apigatewayv2_integration.post_deletereel.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "post_rooms_roomid_invites_reject" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:CreateRoom"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "post_rooms_roomid_invites_reject" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /rooms/{roomId}/invites/reject"
  target             = "integrations/${aws_apigatewayv2_integration.post_rooms_roomid_invites_reject.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "post_rooms_roomid_requests_approve" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:chatRestHandler"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "post_rooms_roomid_requests_approve" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /rooms/{roomId}/requests/approve"
  target             = "integrations/${aws_apigatewayv2_integration.post_rooms_roomid_requests_approve.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "post_rooms_roomid_image" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:Edit-room-img"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "post_rooms_roomid_image" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /rooms/{roomId}/image"
  target             = "integrations/${aws_apigatewayv2_integration.post_rooms_roomid_image.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "post_users_check_email" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:check-email"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "post_users_check_email" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /users/check-email"
  target             = "integrations/${aws_apigatewayv2_integration.post_users_check_email.id}"
  authorization_type = "NONE"
  api_key_required   = false

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "post_chats_start" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:chatRestHandler"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "post_chats_start" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /chats/start"
  target             = "integrations/${aws_apigatewayv2_integration.post_chats_start.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "get_books_id_text" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:MyApi"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "get_books_id_text" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /books/{id}/text"
  target             = "integrations/${aws_apigatewayv2_integration.get_books_id_text.id}"
  authorization_type = "NONE"
  api_key_required   = false

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "get_users_blocked" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:chatRestHandler"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "get_users_blocked" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /users/blocked"
  target             = "integrations/${aws_apigatewayv2_integration.get_users_blocked.id}"
  authorization_type = "JWT"
  api_key_required   = false
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "get_users_find" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:CreateRoom"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "get_users_find" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /users/find"
  target             = "integrations/${aws_apigatewayv2_integration.get_users_find.id}"
  authorization_type = "NONE"
  api_key_required   = false

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}

resource "aws_apigatewayv2_integration" "options_books" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:us-east-1:147179611217:function:MyApi"
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      integration_uri,
      integration_method,
      payload_format_version,
      timeout_milliseconds,
      request_parameters,
      request_templates,
      response_parameters,
      tls_config,
      description
    ]
  }
}

resource "aws_apigatewayv2_route" "options_books" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "OPTIONS /books"
  target             = "integrations/${aws_apigatewayv2_integration.options_books.id}"
  authorization_type = "NONE"
  api_key_required   = false

  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      target,
      authorization_type,
      authorizer_id,
      authorization_scopes,
      request_models,
      request_parameter,
      route_response_selection_expression
    ]
  }
}
