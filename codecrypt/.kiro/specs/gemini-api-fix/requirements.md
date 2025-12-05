# Requirements Document: Gemini API Model Configuration Fix

## Introduction

This document specifies the requirements for configuring CodeCrypt's Gemini API integration to use the correct model name. The system should use `gemini-3-pro-preview`, which is Google's current recommended Gemini API model. This ensures all LLM-based semantic analysis works correctly, enabling the resurrection process's ability to understand developer intent and suggest intelligent modernizations.

## Glossary

- **LLM Analysis Service**: The service responsible for using Google's Gemini API to perform semantic code analysis
- **Gemini API**: Google's generative AI API for code understanding and analysis
- **Model Name**: The specific identifier for the Gemini model version being used
- **API Version**: The version of the Gemini API endpoint (v1, v1beta, etc.)
- **Hybrid Analysis**: The combination of AST (structural) and LLM (semantic) analysis

## Requirements

### Requirement 1

**User Story:** As a developer using CodeCrypt, I want the Gemini API integration to use the correct model name, so that LLM analysis succeeds and provides semantic insights during resurrection.

#### Acceptance Criteria

1. WHEN the LLM analysis service initializes the Gemini client THEN the system SHALL use a valid model name that exists in the Gemini API
2. WHEN the Gemini API is called for code analysis THEN the system SHALL receive successful responses without 404 errors
3. WHEN hybrid analysis runs THEN the system SHALL successfully complete both AST and LLM analysis phases
4. WHEN LLM analysis completes THEN the system SHALL generate developer intent insights and modernization suggestions
5. WHEN the resurrection report is generated THEN the system SHALL include LLM analysis results with non-zero insights

### Requirement 2

**User Story:** As a developer, I want the system to handle Gemini API configuration errors gracefully, so that I receive clear feedback when the API is misconfigured.

#### Acceptance Criteria

1. WHEN the Gemini API returns a 404 model not found error THEN the system SHALL log a clear error message indicating the model name issue
2. WHEN Gemini API initialization fails THEN the system SHALL provide actionable guidance on how to fix the configuration
3. WHEN the model name is invalid THEN the system SHALL suggest valid alternative model names
4. WHEN API errors occur THEN the system SHALL continue with AST-only analysis rather than failing completely

### Requirement 3

**User Story:** As a developer, I want the Gemini model configuration to be easily discoverable and modifiable, so that I can update it when new models become available.

#### Acceptance Criteria

1. WHEN reviewing the LLM analysis service code THEN the model name SHALL be defined in a clearly labeled constant or configuration
2. WHEN the model name needs to be changed THEN the system SHALL require modification in only one location
3. WHEN new Gemini models are released THEN the system SHALL support updating to them by changing a single configuration value
4. WHEN the system starts THEN the system SHALL validate the configured model name is supported
