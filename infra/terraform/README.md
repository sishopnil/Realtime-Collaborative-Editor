# Terraform Skeleton

This folder is a placeholder for infra-as-code. Suggested structure:

- providers (AWS, GCP, Azure)
- modules (networking, cluster, database, cache)
- envs (staging, production) with remote state

Start by creating a VPC/network, managed MongoDB/Redis, and a container runtime (ECS/Kubernetes). Output service endpoints and secrets to your CI/CD.
