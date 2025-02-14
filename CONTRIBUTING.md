# Contributing to Chain 138

## Getting Started

### Prerequisites
- Node.js v16+
- Go 1.19+
- Docker & Docker Compose
- Git

### Development Setup
1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/your-username/chain-138.git
   cd chain-138
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Set up development environment:
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

## Development Workflow

### Branch Naming
- Feature: `feature/description`
- Bug Fix: `fix/description`
- Documentation: `docs/description`
- Performance: `perf/description`
- Refactor: `refactor/description`

### Commit Messages
Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:
- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `style:` Code style changes
- `refactor:` Code refactoring
- `perf:` Performance improvements
- `test:` Test updates
- `chore:` Maintenance tasks

Example:
```bash
git commit -m "feat: implement new protocol feature"
```

### Pull Requests
1. Create a new branch
2. Make your changes
3. Run tests:
   ```bash
   npm test
   ```
4. Run linting:
   ```bash
   npm run lint
   ```
5. Push changes:
   ```bash
   git push origin your-branch-name
   ```
6. Create a Pull Request

### Pull Request Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed

## Checklist
- [ ] Code follows style guidelines
- [ ] Tests passing
- [ ] Documentation updated
- [ ] Commits follow conventions
```

## Code Standards

### Solidity
- Use Solidity ^0.8.0
- Follow [Solidity Style Guide](https://docs.soliditylang.org/en/latest/style-guide.html)
- Use OpenZeppelin contracts where possible
- Include comprehensive NatSpec documentation

Example:
```solidity
/// @title Protocol Interface
/// @notice Provides core protocol functionality
/// @dev Implement for protocol integration
interface IProtocol {
    /// @notice Executes protocol operation
    /// @param params Operation parameters
    /// @return result Operation result
    function execute(
        Params calldata params
    ) external returns (bytes memory result);
}
```

### TypeScript
- Use TypeScript for all JavaScript code
- Follow [TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)
- Include JSDoc documentation
- Use strict type checking

Example:
```typescript
/**
 * Protocol client for development
 * @class ProtocolClient
 */
class ProtocolClient {
    /**
     * Creates protocol instance
     * @param {string} rpc - RPC endpoint
     * @returns {Promise<Protocol>} Protocol instance
     */
    async createProtocol(rpc: string): Promise<Protocol> {
        // Implementation
    }
}
```

## Testing

### Test Requirements
- Maintain 90%+ test coverage
- Include unit tests for all components
- Include integration tests for workflows
- Include performance tests for critical paths

### Running Tests
```bash
# Run all tests
npm test

# Run specific test suite
npm test -- --grep "Protocol"

# Run coverage
npm run coverage
```

## Documentation

### Documentation Requirements
- Update README.md for major changes
- Include inline code documentation
- Update API documentation
- Include examples for new features

### Building Documentation
```bash
# Generate documentation
npm run docs

# Serve documentation locally
npm run docs:serve
```

## Review Process

### Code Review
- All PRs require at least one review
- Address all review comments
- Maintain discussion in PR comments
- Request re-review after changes

### Security Review
- Security-critical changes require security review
- Include security considerations in PR
- Run security analysis tools
- Document potential risks

## Release Process

### Version Control
- Follow [Semantic Versioning](https://semver.org/)
- Update CHANGELOG.md
- Create release tags
- Update documentation version

### Release Checklist
1. Update version numbers
2. Update CHANGELOG.md
3. Run full test suite
4. Create release branch
5. Create GitHub release
6. Deploy to testnet
7. Monitor deployment

## Getting Help

### Resources
- [Documentation](docs/index.md)
- [API Reference](docs/api/api-reference.md)
- [Development Guide](docs/development/development-guide.md)

### Communication
- GitHub Issues for bug reports
- GitHub Discussions for questions
- Security issues: security@chain138.com

## Code of Conduct

### Our Pledge
We pledge to make participation in our project a harassment-free experience for everyone.

### Our Standards
- Use welcoming and inclusive language
- Be respectful of differing viewpoints
- Accept constructive criticism
- Focus on what is best for the community
- Show empathy towards other community members

### Enforcement
- Report violations to conduct@chain138.com
- Maintainers will review and investigate
- Maintainers will maintain confidentiality
- Violations may result in temporary or permanent ban

## License
By contributing, you agree that your contributions will be licensed under the project's MIT License. 