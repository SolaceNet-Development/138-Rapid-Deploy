# Environment Setup Guide

## Prerequisites

### Node.js
- Required version: **18.12.1** (exact)
- Installation:
  ```bash
  # Using nvm (recommended)
  nvm install 18.12.1
  nvm use 18.12.1

  # Verify installation
  node -v # Should output v18.12.1
  ```

### Package Manager
- Required: **pnpm** (version >=8.15.4 <9.15.1)
- Installation:
  ```bash
  # Install pnpm
  npm install -g pnpm@8.15.4

  # Verify installation
  pnpm -v # Should output 8.15.4 or higher
  ```

## Project Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/SolaceNet-Development/138-Rapid-Deploy.git
   cd 138-Rapid-Deploy
   ```

2. Install dependencies:
   ```bash
   # pnpm will automatically use the correct Node.js version from .nvmrc
   pnpm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

## Development Tools

### Code Quality
- ESLint for linting
- TypeScript for type checking
- Husky for pre-commit hooks

The project enforces:
- Strict TypeScript checks
- Consistent code formatting
- Pre-commit linting

### Testing
- Run tests: `pnpm test`
- Run coverage: `pnpm run test:coverage`
- Run linting: `pnpm run lint`
- Auto-fix linting: `pnpm run lint -- --fix`

## Troubleshooting

### Common Issues

1. Wrong Node.js version:
   ```bash
   # Error: Node.js version must be exactly v18.12.1
   nvm use 18.12.1
   ```

2. pnpm installation issues:
   ```bash
   # Clear pnpm store and reinstall
   pnpm store prune
   pnpm install
   ```

3. Linting errors:
   ```bash
   # Fix automatically fixable issues
   pnpm run lint -- --fix
   ```

## Security Considerations

- All pull requests undergo security scanning
- Security monitoring is enabled
- Critical and high severity alerts are routed to security team

## CI/CD Pipeline

The project uses GitHub Actions for:
- Automated testing
- Security scanning
- Code quality checks
- Deployment pipelines

## Support

For any setup issues:
- Check the troubleshooting guide above
- Contact the development team
- Raise an issue in the repository
