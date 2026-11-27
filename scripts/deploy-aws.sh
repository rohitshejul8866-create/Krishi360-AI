#!/usr/bin/env bash
set -euo pipefail

# KRISHI360 AI — AWS Connection & Deployment Script
# Usage:
#   ./scripts/deploy-aws.sh verify
#   ./scripts/deploy-aws.sh serverless [dev|staging|prod] [region]
#   ./scripts/deploy-aws.sh ecr [repo-name] [region]

MODE="${1:-verify}"
ENV_NAME="${2:-prod}"
REGION="${3:-${AWS_REGION:-ap-south-1}}"
STACK_NAME="krishi360-${ENV_NAME}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Error: '$1' CLI is required but not installed." >&2
    exit 1
  fi
}

check_aws_auth() {
  require_cmd aws
  echo "Checking active AWS identity..."
  aws sts get-caller-identity --output table
}

case "$MODE" in
  verify)
    echo "1/3 Building frontend production bundle..."
    npm run build
    echo "2/3 Building production server bundle..."
    npm run build:server
    echo "3/3 Checking AWS credentials..."
    check_aws_auth
    echo "AWS credentials and local production builds are verified."
    ;;

  serverless)
    check_aws_auth
    require_cmd sam

    echo "1/5 Building frontend SPA (dist/)..."
    npm run build

    echo "2/5 Building AWS SAM Lambda artifacts..."
    sam build --template-file backend/template.yaml

    echo "3/5 Deploying CloudFormation stack '${STACK_NAME}' in ${REGION}..."
    SESSION_SECRET_VAL="${SESSION_SECRET:-$(node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))")}"
    AI_PROVIDER_VAL="${AI_PROVIDER:-gemini}"
    GEMINI_KEY_VAL="${GEMINI_API_KEY:-}"
    ALLOWED_ORIGINS_VAL="${ALLOWED_ORIGINS:-http://localhost:3000}"

    sam deploy \
      --stack-name "${STACK_NAME}" \
      --region "${REGION}" \
      --capabilities CAPABILITY_IAM \
      --resolve-s3 \
      --no-confirm-changeset \
      --no-fail-on-empty-changeset \
      --parameter-overrides \
        EnvironmentName="${ENV_NAME}" \
        AuthMode="session" \
        SessionSecret="${SESSION_SECRET_VAL}" \
        AiProvider="${AI_PROVIDER_VAL}" \
        GeminiApiKey="${GEMINI_KEY_VAL}" \
        AllowedOrigins="${ALLOWED_ORIGINS_VAL}"

    WEBSITE_BUCKET="$(aws cloudformation describe-stacks --stack-name "${STACK_NAME}" --region "${REGION}" --query "Stacks[0].Outputs[?OutputKey=='WebsiteBucketName'].OutputValue" --output text)"
    DIST_ID="$(aws cloudformation describe-stacks --stack-name "${STACK_NAME}" --region "${REGION}" --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" --output text)"
    WEBSITE_URL="$(aws cloudformation describe-stacks --stack-name "${STACK_NAME}" --region "${REGION}" --query "Stacks[0].Outputs[?OutputKey=='WebsiteUrl'].OutputValue" --output text)"

    echo "4/5 Syncing frontend dist/ to S3 bucket s3://${WEBSITE_BUCKET}..."
    aws s3 sync dist/ "s3://${WEBSITE_BUCKET}/" --delete --region "${REGION}"

    echo "5/5 Invalidating CloudFront distribution ${DIST_ID}..."
    aws cloudfront create-invalidation --distribution-id "${DIST_ID}" --paths "/*" >/dev/null

    echo "Deployment complete!"
    echo "Website URL: ${WEBSITE_URL}"
    ;;

  ecr)
    check_aws_auth
    require_cmd docker
    REPO_NAME="${2:-krishi360-ai}"
    ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
    ECR_URI="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${REPO_NAME}"

    aws ecr describe-repositories --repository-names "${REPO_NAME}" --region "${REGION}" >/dev/null 2>&1 \
      || aws ecr create-repository --repository-name "${REPO_NAME}" --region "${REGION}" >/dev/null

    aws ecr get-login-password --region "${REGION}" | docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"
    docker build -t "${REPO_NAME}:latest" .
    docker tag "${REPO_NAME}:latest" "${ECR_URI}:latest"
    docker push "${ECR_URI}:latest"
    echo "Pushed container image to ${ECR_URI}:latest (ready for AWS App Runner or ECS Fargate)."
    ;;

  *)
    echo "Unknown mode '$MODE'. Use: verify | serverless | ecr" >&2
    exit 1
    ;;
esac
