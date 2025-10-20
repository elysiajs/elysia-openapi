# Fix Cross-Platform Path Handling Issues

## Summary

This PR addresses multiple cross-platform compatibility issues in the `@elysiajs/openapi` package, specifically:

1. **Windows EBUSY errors** when removing temporary directories
2. **Path separator inconsistencies** between Windows and Unix systems
3. **TypeScript compilation path issues** requiring Unix format paths
4. **Temporary directory permission problems** on different platforms
5. **Module resolution failures** in monorepo environments with custom path aliases

## Problems Fixed

### 1. Windows Resource Locking Issues
- **Problem**: `EBUSY: resource busy or locked` errors when deleting temporary directories on Windows
- **Solution**: Implemented `PathUtils.safeRemove()` with retry mechanism and proper error handling
- **Impact**: Eliminates random failures during `fromTypes()` execution on Windows

### 2. Path Separator Inconsistencies
- **Problem**: Mixed path separators causing issues across different operating systems
- **Solution**: Created comprehensive `PathUtils` class with intelligent path normalization
- **Impact**: Consistent behavior across Windows, macOS, and Linux

### 3. TypeScript CLI Path Requirements
- **Problem**: TypeScript CLI requires Unix-format paths in certain scenarios
- **Solution**: Added automatic path format conversion for TypeScript compilation
- **Impact**: Reliable TypeScript compilation in cross-platform environments

### 4. Temporary Directory Management
- **Problem**: Different permission models and access patterns across platforms
- **Solution**: Platform-specific temporary directory strategy (Windows: project-local cache, Unix: system temp)
- **Impact**: Improved reliability and security across all platforms

### 5. Monorepo Path Mapping Support
- **Problem**: Custom path aliases (e.g., `@backend/*`) not resolving in temporary TypeScript projects
- **Solution**: Enhanced tsconfig generation with proper baseUrl and paths extraction
- **Impact**: Full compatibility with complex monorepo setups

## Changes Made

### New Files Added
- `src/utils/path.ts` - Comprehensive cross-platform path handling utility
- `src/utils/path-examples.ts` - Usage examples and demonstrations
- `PATH_GUIDE.md` - Detailed documentation for the path handling solution

### Core Modifications
- **`src/gen/index.ts`**: Replaced simple path joining with robust PathUtils integration
- **`src/gen/index.ts`**: Enhanced temporary directory management
- **`src/gen/index.ts`**: Improved TypeScript configuration generation with path mapping support
- **`src/gen/index.ts`**: Added safe file deletion with retry mechanism

### Key Features Implemented

#### PathUtils Utility Class
- **Path Normalization**: Converts paths to current system standard format
- **Format Conversion**: Unix ↔ Windows path format conversion
- **Smart Joining**: Cross-platform path concatenation
- **Safe Removal**: File/directory deletion with retry on Windows
- **Path Comparison**: Cross-platform path equality checking
- **Debug Support**: Detailed path information for troubleshooting

#### Enhanced TypeScript Integration
- **Automatic Path Mapping**: Extracts and applies baseUrl and paths from original tsconfig
- **Unix Format Conversion**: Ensures TypeScript CLI compatibility
- **Monorepo Support**: Handles complex workspace configurations

## Testing

### Cross-Platform Validation
- ✅ Windows 10/11 compatibility verified
- ✅ macOS compatibility verified
- ✅ Linux compatibility verified
- ✅ Monorepo environments tested
- ✅ Complex path mapping scenarios validated

### Build Verification
- ✅ All builds pass without TypeScript errors
- ✅ No breaking changes to existing API
- ✅ Backward compatibility maintained

## Benefits

1. **Improved Reliability**: Eliminates random failures on Windows systems
2. **Better Developer Experience**: Consistent behavior across all platforms
3. **Enhanced Compatibility**: Full support for complex monorepo setups
4. **Future-Proof**: Comprehensive path handling foundation for future development
5. **Better Error Handling**: Informative error messages and recovery mechanisms

## Breaking Changes

None. This is a pure bug fix and enhancement release with no breaking changes to the public API.

## Performance Impact

Minimal to none. The PathUtils operations are lightweight and only add minor overhead during temporary directory management, which occurs infrequently.

## Migration Guide

No migration required. Existing code will continue to work as before, with improved reliability and cross-platform compatibility.

## Testing Instructions

To test the cross-platform improvements:

```bash
# Build the project
pnpm run build

# Test path utilities
node dist/cjs/utils/path-examples.js

# Test fromTypes functionality in a monorepo setup
# (See PATH_GUIDE.md for detailed instructions)
```

## Related Issues

This PR addresses common cross-platform issues that users may encounter when:
- Using `fromTypes()` on Windows systems
- Working in monorepo environments with custom path aliases
- Running the package across different operating systems
- Experiencing temporary directory permission issues

## Documentation

Comprehensive documentation has been added in `PATH_GUIDE.md` covering:
- Problem descriptions and solutions
- Usage examples and best practices
- Platform-specific considerations
- Troubleshooting guides
- API reference for PathUtils

---

This implementation significantly improves the robustness and cross-platform compatibility of the `@elysiajs/openapi` package, particularly for users working in complex development environments.