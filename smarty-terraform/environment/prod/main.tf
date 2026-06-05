terraform {
  required_version = ">= 1.8.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

module "cloudwatch_logs" {
  source = "../../modules/cloudwatch-logs"

  retention_days = 30

  log_groups = [
    "/aws/lambda/AIcontent",
    "/aws/lambda/CreateRoom",
    "/aws/lambda/Edit-room-img",
    "/aws/lambda/Explaination",
    "/aws/lambda/JoinRoom",
    "/aws/lambda/MyApi",
    "/aws/lambda/Topic_media",
    "/aws/lambda/addComment",
    "/aws/lambda/chat-media",
    "/aws/lambda/chatConnect",
    "/aws/lambda/chatDisconnect",
    "/aws/lambda/chatRestHandler",
    "/aws/lambda/chatSendMessage",
    "/aws/lambda/check-email",
    "/aws/lambda/createReel",
    "/aws/lambda/dailyReminderHandler",
    "/aws/lambda/deleteComment",
    "/aws/lambda/deleteReel",
    "/aws/lambda/delete_chat",
    "/aws/lambda/delete_room",
    "/aws/lambda/editComment",
    "/aws/lambda/generateQuizQuestions",
    "/aws/lambda/getComments",
    "/aws/lambda/getMyReels",
    "/aws/lambda/getReelById",
    "/aws/lambda/getSavedReels",
    "/aws/lambda/getTextReels",
    "/aws/lambda/getTopics",
    "/aws/lambda/getUploadUrl",
    "/aws/lambda/gpay-anumedicals",
    "/aws/lambda/invite-link",
    "/aws/lambda/likeTextReel",
    "/aws/lambda/link_google_user",
    "/aws/lambda/news",
    "/aws/lambda/room_invite",
    "/aws/lambda/saveCognitoUser",
    "/aws/lambda/saveQuizResult",
    "/aws/lambda/saveReel",
    "/aws/lambda/sendmsg",
    "/aws/lambda/test",
    "/aws/lambda/topicRoomSendMessage",
    "/aws/lambda/toy-store-create-order",
    "/aws/lambda/toy-store-get-products",
    "/aws/lambda/translate",
    "/aws/lambda/updateUserProfile"
  ]
}

module "lambda" {
  source = "../../modules/lambda"

  functions = {
    "delete_chat" = {
      runtime     = "python3.12"
      handler     = "lambda_function.lambda_handler"
      timeout     = 3
      memory_size = 128
      role_arn    = "arn:aws:iam::147179611217:role/service-role/delete_chat-role-67hje7c4"
      filename    = "../../lambda-zips/delete_chat.zip"
      environment = {}
    }

    "likeTextReel" = {
      runtime     = "python3.14"
      handler     = "lambda_function.lambda_handler"
      timeout     = 3
      memory_size = 128
      role_arn    = "arn:aws:iam::147179611217:role/service-role/likeTextReel-role-zf1ixgtw"
      filename    = "../../lambda-zips/likeTextReel.zip"
      environment = {}
    }

    "getUploadUrl" = {
      runtime     = "python3.14"
      handler     = "lambda_function.lambda_handler"
      timeout     = 3
      memory_size = 128
      role_arn    = "arn:aws:iam::147179611217:role/service-role/getUploadUrl-role-6ic1st73"
      filename    = "../../lambda-zips/getUploadUrl.zip"
      environment = {}
    }

    "MyApi" = {
      runtime     = "python3.12"
      handler     = "lambda_function.lambda_handler"
      timeout     = 40
      memory_size = 128
      role_arn    = "arn:aws:iam::147179611217:role/service-role/MyApi-role-etxsjt3c"
      filename    = "../../lambda-zips/MyApi.zip"
      environment = {}
    }

    "chatConnect" = {
      runtime     = "python3.12"
      handler     = "lambda_function.lambda_handler"
      timeout     = 3
      memory_size = 128
      role_arn    = "arn:aws:iam::147179611217:role/service-role/chatConnect-role-uoem8cff"
      filename    = "../../lambda-zips/chatConnect.zip"
      environment = {}
    }

    "link_google_user" = {
      runtime     = "nodejs24.x"
      handler     = "index.handler"
      timeout     = 3
      memory_size = 128
      role_arn    = "arn:aws:iam::147179611217:role/service-role/link_google_user-role-6jpsarzg"
      filename    = "../../lambda-zips/link_google_user.zip"
      environment = {}
    }

    "translate" = {
      runtime     = "python3.12"
      handler     = "lambda_function.lambda_handler"
      timeout     = 123
      memory_size = 128
      role_arn    = "arn:aws:iam::147179611217:role/service-role/translate-role-kv8e4o47"
      filename    = "../../lambda-zips/translate.zip"
      environment = {}
    }

    "invite-link" = {
      runtime     = "python3.12"
      handler     = "lambda_function.lambda_handler"
      timeout     = 3
      memory_size = 128
      role_arn    = "arn:aws:iam::147179611217:role/service-role/invite-link-role-4v1bcsmp"
      filename    = "../../lambda-zips/invite-link.zip"
      environment = {}
    }

    "getTopics" = {
      runtime     = "python3.14"
      handler     = "lambda_function.lambda_handler"
      timeout     = 3
      memory_size = 128
      role_arn    = "arn:aws:iam::147179611217:role/service-role/getTopics-role-gmweo1ii"
      filename    = "../../lambda-zips/getTopics.zip"
      environment = {}
    }

    "saveReel" = {
      runtime     = "python3.14"
      handler     = "lambda_function.lambda_handler"
      timeout     = 3
      memory_size = 128
      role_arn    = "arn:aws:iam::147179611217:role/service-role/saveReel-role-w0tebmz3"
      filename    = "../../lambda-zips/saveReel.zip"
      environment = {}
    }

    "deleteReel" = {
      runtime     = "python3.14"
      handler     = "lambda_function.lambda_handler"
      timeout     = 3
      memory_size = 128
      role_arn    = "arn:aws:iam::147179611217:role/service-role/deleteReel-role-dkeipnwy"
      filename    = "../../lambda-zips/deleteReel.zip"
      environment = {}
    }

    "gpay-anumedicals" = {
      runtime     = "nodejs22.x"
      handler     = "index.handler"
      timeout     = 3
      memory_size = 128
      role_arn    = "arn:aws:iam::147179611217:role/service-role/gpay-anumedicals-role-98xvfsvl"
      filename    = "../../lambda-zips/gpay-anumedicals.zip"
      environment = {}
    }

    "saveCognitoUser" = {
      runtime     = "python3.12"
      handler     = "lambda_function.lambda_handler"
      timeout     = 3
      memory_size = 128
      role_arn    = "arn:aws:iam::147179611217:role/service-role/saveCognitoUser-role-lmuxyxet"
      filename    = "../../lambda-zips/saveCognitoUser.zip"
      environment = {}
    }

    "sendmsg" = {
      runtime     = "nodejs20.x"
      handler     = "index.handler"
      timeout     = 30
      memory_size = 128
      role_arn    = "arn:aws:iam::147179611217:role/service-role/sendmsg-role-4irg5fms"
      filename    = "../../lambda-zips/sendmsg.zip"
      environment = {}
    }

    "chatSendMessage" = {
      runtime     = "python3.12"
      handler     = "lambda_function.lambda_handler"
      timeout     = 3
      memory_size = 128
      role_arn    = "arn:aws:iam::147179611217:role/service-role/chatSendMessage-role-jlq1arfe"
      filename    = "../../lambda-zips/chatSendMessage.zip"
      environment = {}
    }

    "chatRestHandler" = {
      runtime     = "python3.12"
      handler     = "lambda_function.lambda_handler"
      timeout     = 3
      memory_size = 128
      role_arn    = "arn:aws:iam::147179611217:role/service-role/chatRestHandler-role-xbfykuut"
      filename    = "../../lambda-zips/chatRestHandler.zip"
      environment = {}
    }

    "AIcontent" = {
      runtime     = "python3.12"
      handler     = "lambda_function.lambda_handler"
      timeout     = 183
      memory_size = 128
      role_arn    = "arn:aws:iam::147179611217:role/service-role/AIcontent-role-t1807drp"
      filename    = "../../lambda-zips/AIcontent.zip"
      environment = {}
    }

    "getSavedReels" = {
      runtime     = "python3.14"
      handler     = "lambda_function.lambda_handler"
      timeout     = 3
      memory_size = 128
      role_arn    = "arn:aws:iam::147179611217:role/service-role/getSavedReels-role-djgnt0em"
      filename    = "../../lambda-zips/getSavedReels.zip"
      environment = {}
    }

    "getTextReels" = {
      runtime     = "python3.14"
      handler     = "lambda_function.lambda_handler"
      timeout     = 3
      memory_size = 128
      role_arn    = "arn:aws:iam::147179611217:role/service-role/getTextReels-role-ccedlc7i"
      filename    = "../../lambda-zips/getTextReels.zip"
      environment = {}
    }

    "getReelById" = {
      runtime     = "python3.14"
      handler     = "lambda_function.lambda_handler"
      timeout     = 3
      memory_size = 128
      role_arn    = "arn:aws:iam::147179611217:role/service-role/getReelById-role-awl0ty12"
      filename    = "../../lambda-zips/getReelById.zip"
      environment = {}
    }

    "Edit-room-img" = {
      runtime     = "python3.12"
      handler     = "lambda_function.lambda_handler"
      timeout     = 3
      memory_size = 128
      role_arn    = "arn:aws:iam::147179611217:role/service-role/Edit-room-img-role-re471ihz"
      filename    = "../../lambda-zips/Edit-room-img.zip"
      environment = {}
    }

    "addComment" = {
      runtime     = "python3.14"
      handler     = "lambda_function.lambda_handler"
      timeout     = 3
      memory_size = 128
      role_arn    = "arn:aws:iam::147179611217:role/service-role/addComment-role-em6z4z11"
      filename    = "../../lambda-zips/addComment.zip"
      environment = {}
    }

    "Explaination" = {
      runtime     = "python3.12"
      handler     = "lambda_function.lambda_handler"
      timeout     = 63
      memory_size = 128
      role_arn    = "arn:aws:iam::147179611217:role/service-role/Explaination-role-247j8y0b"
      filename    = "../../lambda-zips/Explaination.zip"
      environment = {}
    }

    "saveQuizResult" = {
      runtime     = "nodejs24.x"
      handler     = "index.handler"
      timeout     = 3
      memory_size = 128
      role_arn    = "arn:aws:iam::147179611217:role/service-role/saveQuizResult-role-uo270gov"
      filename    = "../../lambda-zips/saveQuizResult.zip"
      environment = {}
    }

    "toy-store-create-order" = {
      runtime     = "nodejs20.x"
      handler     = "src/createOrder.handler"
      timeout     = 3
      memory_size = 128
      role_arn    = "arn:aws:iam::147179611217:role/toy-store-lambda-role"
      filename    = "../../lambda-zips/toy-store-create-order.zip"
      environment = {}
    }

    "deleteComment" = {
      runtime     = "python3.12"
      handler     = "lambda_function.lambda_handler"
      timeout     = 3
      memory_size = 128
      role_arn    = "arn:aws:iam::147179611217:role/service-role/deleteComment-role-kk5ues0x"
      filename    = "../../lambda-zips/deleteComment.zip"
      environment = {}
    }

    "CreateRoom" = {
      runtime     = "python3.12"
      handler     = "lambda_function.lambda_handler"
      timeout     = 3
      memory_size = 128
      role_arn    = "arn:aws:iam::147179611217:role/service-role/CreateRoom-role-91vfqm2w"
      filename    = "../../lambda-zips/CreateRoom.zip"
      environment = {}
    }

    "updateReel" = {
      runtime     = "python3.14"
      handler     = "lambda_function.lambda_handler"
      timeout     = 3
      memory_size = 128
      role_arn    = "arn:aws:iam::147179611217:role/service-role/updateReel-role-cbj6b4nc"
      filename    = "../../lambda-zips/updateReel.zip"
      environment = {}
    }

    "editComment" = {
      runtime     = "python3.12"
      handler     = "lambda_function.lambda_handler"
      timeout     = 3
      memory_size = 128
      role_arn    = "arn:aws:iam::147179611217:role/service-role/editComment-role-6gu9b3b5"
      filename    = "../../lambda-zips/editComment.zip"
      environment = {}
    }

    "dailyReminderHandler" = {
      runtime     = "nodejs20.x"
      handler     = "index.handler"
      timeout     = 30
      memory_size = 128
      role_arn    = "arn:aws:iam::147179611217:role/service-role/dailyReminderHandler-role-74kogzxs"
      filename    = "../../lambda-zips/dailyReminderHandler.zip"
      environment = {}
    }

    "check-email" = {
      runtime     = "python3.12"
      handler     = "lambda_function.lambda_handler"
      timeout     = 3
      memory_size = 128
      role_arn    = "arn:aws:iam::147179611217:role/service-role/check-email-role-4p1urh6x"
      filename    = "../../lambda-zips/check-email.zip"
      environment = {}
    }

    "chatDisconnect" = {
      runtime     = "python3.12"
      handler     = "lambda_function.lambda_handler"
      timeout     = 3
      memory_size = 128
      role_arn    = "arn:aws:iam::147179611217:role/service-role/chatDisconnect-role-skq4m5co"
      filename    = "../../lambda-zips/chatDisconnect.zip"
      environment = {}
    }

    "Topic_media" = {
      runtime     = "python3.12"
      handler     = "lambda_function.lambda_handler"
      timeout     = 3
      memory_size = 128
      role_arn    = "arn:aws:iam::147179611217:role/service-role/Topic_media-role-qniozyus"
      filename    = "../../lambda-zips/Topic_media.zip"
      environment = {}
    }

    "createReel" = {
      runtime     = "python3.14"
      handler     = "lambda_function.lambda_handler"
      timeout     = 3
      memory_size = 128
      role_arn    = "arn:aws:iam::147179611217:role/service-role/createReel-role-o7wunv8j"
      filename    = "../../lambda-zips/createReel.zip"
      environment = {}
    }

    "test" = {
      runtime     = "python3.12"
      handler     = "lambda_function.lambda_handler"
      timeout     = 3
      memory_size = 128
      role_arn    = "arn:aws:iam::147179611217:role/service-role/test-role-5c7eo304"
      filename    = "../../lambda-zips/test.zip"
      environment = {}
    }

    "room_invite" = {
      runtime     = "python3.12"
      handler     = "lambda_function.handler"
      timeout     = 3
      memory_size = 128
      role_arn    = "arn:aws:iam::147179611217:role/service-role/room_invite-role-12skvh0c"
      filename    = "../../lambda-zips/room_invite.zip"
      environment = {}
    }

    "news" = {
      runtime     = "python3.12"
      handler     = "lambda_function.lambda_handler"
      timeout     = 3
      memory_size = 128
      role_arn    = "arn:aws:iam::147179611217:role/service-role/news-role-507fc3ni"
      filename    = "../../lambda-zips/news.zip"
      environment = {}
    }

    "topicRoomSendMessage" = {
      runtime     = "python3.12"
      handler     = "lambda_function.lambda_handler"
      timeout     = 3
      memory_size = 128
      role_arn    = "arn:aws:iam::147179611217:role/service-role/topicRoomSendMessage-role-bbph0m73"
      filename    = "../../lambda-zips/topicRoomSendMessage.zip"
      environment = {}
    }

    "chat-media" = {
      runtime     = "python3.12"
      handler     = "lambda_function.lambda_handler"
      timeout     = 3
      memory_size = 128
      role_arn    = "arn:aws:iam::147179611217:role/service-role/chat-media-role-22eheo51"
      filename    = "../../lambda-zips/chat-media.zip"
      environment = {}
    }

    "delete_room" = {
      runtime     = "python3.12"
      handler     = "lambda_function.lambda_handler"
      timeout     = 3
      memory_size = 128
      role_arn    = "arn:aws:iam::147179611217:role/service-role/delete_room-role-6xo6pw9h"
      filename    = "../../lambda-zips/delete_room.zip"
      environment = {}
    }

    "JoinRoom" = {
      runtime     = "python3.12"
      handler     = "lambda_function.lambda_handler"
      timeout     = 3
      memory_size = 128
      role_arn    = "arn:aws:iam::147179611217:role/service-role/JoinRoom-role-78lqwo0b"
      filename    = "../../lambda-zips/JoinRoom.zip"
      environment = {}
    }

    "getMyReels" = {
      runtime     = "python3.14"
      handler     = "lambda_function.lambda_handler"
      timeout     = 3
      memory_size = 128
      role_arn    = "arn:aws:iam::147179611217:role/service-role/getMyReels-role-phtj472o"
      filename    = "../../lambda-zips/getMyReels.zip"
      environment = {}
    }

    "getComments" = {
      runtime     = "python3.14"
      handler     = "lambda_function.lambda_handler"
      timeout     = 3
      memory_size = 128
      role_arn    = "arn:aws:iam::147179611217:role/service-role/getComments-role-h3nx7ftz"
      filename    = "../../lambda-zips/getComments.zip"
      environment = {}
    }

    "updateUserProfile" = {
      runtime     = "python3.12"
      handler     = "lambda_function.lambda_handler"
      timeout     = 3
      memory_size = 128
      role_arn    = "arn:aws:iam::147179611217:role/service-role/updateUserProfile-role-rivejvux"
      filename    = "../../lambda-zips/updateUserProfile.zip"
      environment = {}
    }

    "generateQuizQuestions" = {
      runtime     = "nodejs24.x"
      handler     = "index.handler"
      timeout     = 60
      memory_size = 128
      role_arn    = "arn:aws:iam::147179611217:role/service-role/generateQuizQuestions-role-v810xph7"
      filename    = "../../lambda-zips/generateQuizQuestions.zip"
      environment = {}
    }

    "toy-store-get-products" = {
      runtime     = "nodejs20.x"
      handler     = "src/getProducts.handler"
      timeout     = 3
      memory_size = 128
      role_arn    = "arn:aws:iam::147179611217:role/toy-store-lambda-role"
      filename    = "../../lambda-zips/toy-store-get-products.zip"
      environment = {}
    }

  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "Smarty"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

module "s3" {
  source = "../../modules/s3"

  buckets = [
    "smarty-chat-media",
    "smarty-post-images",
    "smarty-room-images",
  ]
}

module "dynamodb" {
  source = "../../modules/dynamodb"

  tables = {
    ChatConnections = {
      hash_key = "connectionId"
    }

    ChatMessages = {
      hash_key  = "chatId"
      range_key = "messageId"
    }

    DailyNews = {
      hash_key = "date"
    }

    HiddenRooms = {
      hash_key  = "userId"
      range_key = "roomId"
    }

    Notifications = {
      hash_key  = "userId"
      range_key = "notificationId"
    }

    PostAiDoubts = {
      hash_key = "doubtId"
    }

    QuizQuestionCache = {
      hash_key = "cacheKey"
    }

    ReelComments = {
      hash_key  = "reelId"
      range_key = "commentId"
    }

    ReelLikes = {
      hash_key  = "userId"
      range_key = "reelId"
    }

    RoomInviteLinks = {
      hash_key = "inviteCode"
    }

    SavedReels = {
      hash_key  = "userId"
      range_key = "reelId"
    }

    SmartyChats = {
      hash_key  = "userId"
      range_key = "chatId"
    }

    SmartyExplanations = {
      hash_key = "explanationId"
    }

    SmartyTranslations = {
      hash_key = "translationId"
    }

    SmartyUsers = {
      hash_key = "userId"
    }

    TextReels = {
      hash_key = "id"
    }

    TopicMessages = {
      hash_key  = "topicId"
      range_key = "messageId"
    }

    TopicRoomInvites = {
      hash_key  = "roomId"
      range_key = "invitedUserId"
    }

    TopicRoomJoinRequests = {
      hash_key  = "roomId"
      range_key = "userId"
    }

    TopicRoomMembers = {
      hash_key  = "roomId"
      range_key = "userId"
    }

    TopicRoomMessages = {
      hash_key  = "roomId"
      range_key = "messageId"
    }

    TopicRooms = {
      hash_key = "roomId"
    }

    UserBlocks = {
      hash_key  = "userId"
      range_key = "chatId"
    }

    UserFollows = {
      hash_key  = "followerId"
      range_key = "followingId"
    }

    UserPushTokens = {
      hash_key  = "userId"
      range_key = "token"
    }

    UserQuizProgress = {
      hash_key  = "userId"
      range_key = "topicId"
    }

    UserQuizQuestionHistory = {
      hash_key = "historyKey"
    }

    UserReports = {
      hash_key = "reportId"
    }
  }
}

module "cognito" {
  source = "../../modules/cognito"

  user_pool_name = "User pool - zzactg"

  callback_urls = []
  logout_urls   = []
}

module "amplify" {
  source = "../../modules/amplify"

  app_name    = "Smarty"
  repository  = "https://github.com/Thanesh177/Smarty.git"
  branch_name = "staging"

  environment_variables = {
    VITE_AWS_REGION           = "us-east-1"
    VITE_COGNITO_USER_POOL_ID = "us-east-1_URSwWqOE0"
    VITE_COGNITO_CLIENT_ID    = "lc4jps1jl06l834msn6eqs5t5"
  }
}


module "http_api" {
  source = "../../modules/http-api"

  api_name = "smarty"
}

module "websocket_api" {
  source = "../../modules/websocket-api"

  api_name = "smarty-chat-ws"
}

module "scheduler" {
  source = "../../modules/scheduler"

  schedules = {
    Daily_content = {
      schedule_expression          = "rate(1 days)"
      schedule_expression_timezone = "Asia/Calcutta"
      target_arn                   = "arn:aws:lambda:us-east-1:147179611217:function:AIcontent"
      role_arn                     = "arn:aws:iam::147179611217:role/service-role/Smarty_Daily_Content"
    }

    Daily_remainder = {
      schedule_expression          = "rate(1 days)"
      schedule_expression_timezone = "Asia/Calcutta"
      target_arn                   = "arn:aws:lambda:us-east-1:147179611217:function:dailyReminderHandler"
      role_arn                     = "arn:aws:iam::147179611217:role/service-role/Amazon_EventBridge_Scheduler_LAMBDA_ecb6730e17"
    }
  }
}

module "cloudfront" {
  source = "../../modules/cloudfront"

  distributions = {
    room_images = {
      enabled            = true
      origin_domain_name = "smarty-room-images.s3.us-east-1.amazonaws.com"
      origin_id          = "smarty-room-images.s3.us-east-1.amazonaws.com-movae5fkx5a"
      oac_id             = "E35JFK7T830AQ3"
      web_acl_id         = "arn:aws:wafv2:us-east-1:147179611217:global/webacl/CreatedByCloudFront-2650053c/97a71c31-50d5-4d3d-aff8-605c8106723c"
      comment            = ""
      is_ipv6_enabled    = true
      name_tag           = "smarty_topic_image"
    }

    post_images = {
      enabled            = true
      origin_domain_name = "smarty-post-images.s3.us-east-1.amazonaws.com"
      origin_id          = "smarty-post-images.s3.us-east-1.amazonaws.com-moxxju8c5kn"
      oac_id             = "EKD93JVL9LEMS"
      web_acl_id         = "arn:aws:wafv2:us-east-1:147179611217:global/webacl/CreatedByCloudFront-80ada625/58918be1-4ee7-4a16-86a6-316daabcaa6c"
      comment            = ""
      is_ipv6_enabled    = true
      name_tag           = "Smarty_post_img"
    }
  }
}