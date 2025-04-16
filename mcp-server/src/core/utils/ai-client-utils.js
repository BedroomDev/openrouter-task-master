/**
 * ai-client-utils.js
 * Utility functions for initializing AI clients in MCP context
 */

import { Anthropic } from '@anthropic-ai/sdk';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';
import logger from '../../logger.js';

// Load environment variables for CLI mode
dotenv.config();

// Default configuration for AI interactions
const DEFAULT_MAX_TOKENS = 64000;
const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_MODEL = 'anthropic/claude-3.7-sonnet';

// Default model configuration from CLI environment
const DEFAULT_MODEL_CONFIG = {
	model: DEFAULT_MODEL,
	maxTokens: DEFAULT_MAX_TOKENS,
	temperature: DEFAULT_TEMPERATURE
};

/**
 * Get an OpenRouter client instance configured to use Anthropic models via OpenAI SDK
 * @param {Object} [session] - Session object from MCP containing environment variables
 * @param {Object} [log] - Logger object to use (defaults to console)
 * @returns {OpenAI} OpenAI client instance configured for OpenRouter
 * @throws {Error} If API key is missing
 */
export function getAnthropicClientForMCP(session, log = console) {
	try {
		// Continue using ANTHROPIC_API_KEY but connect to OpenRouter
		const apiKey =
			session?.env?.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;

		if (!apiKey) {
			throw new Error(
				'ANTHROPIC_API_KEY not found in session environment or process.env'
			);
		}

		// Project identification for OpenRouter analytics
		const siteUrl = session?.env?.YOUR_SITE_URL || process.env.YOUR_SITE_URL || 'https://task-master-ai.app';
		const siteName = session?.env?.YOUR_SITE_NAME || process.env.YOUR_SITE_NAME || 'Task Master AI';

		log.info(`Initializing OpenRouter client with ANTHROPIC_API_KEY (length: ${apiKey.length})`);
		log.debug(`OpenRouter client configuration: baseURL=https://openrouter.ai/api/v1, siteUrl=${siteUrl}, siteName=${siteName}`);

		// Initialize and return a new OpenAI client configured for OpenRouter
		const client = new OpenAI({
			apiKey, // Using ANTHROPIC_API_KEY with OpenRouter
			baseURL: 'https://openrouter.ai/api/v1',
			defaultHeaders: {
				'HTTP-Referer': siteUrl,
				'X-Title': siteName
			}
		});

		// Verify the client was properly created
		if (!client || !client.chat || !client.chat.completions) {
			throw new Error('OpenRouter client was not properly initialized');
		}

		log.info('OpenRouter client successfully initialized');
		return client;
	} catch (error) {
		log.error(`Failed to initialize OpenRouter client: ${error.message}`);
		throw error;
	}
}

/**
 * Get a Perplexity client instance initialized with MCP session environment variables
 * @param {Object} [session] - Session object from MCP containing environment variables
 * @param {Object} [log] - Logger object to use (defaults to console)
 * @returns {OpenAI} OpenAI client configured for Perplexity API
 * @throws {Error} If API key is missing or OpenAI package can't be imported
 */
export async function getPerplexityClientForMCP(session, log = console) {
	try {
		// Extract API key from session.env or fall back to environment variables
		const apiKey =
			session?.env?.PERPLEXITY_API_KEY || process.env.PERPLEXITY_API_KEY;

		if (!apiKey) {
			throw new Error(
				'PERPLEXITY_API_KEY not found in session environment or process.env'
			);
		}

		// Dynamically import OpenAI (it may not be used in all contexts)
		const { default: OpenAI } = await import('openai');

		// Initialize and return a new OpenAI client configured for Perplexity
		return new OpenAI({
			apiKey,
			baseURL: 'https://api.perplexity.ai'
		});
	} catch (error) {
		log.error(`Failed to initialize Perplexity client: ${error.message}`);
		throw error;
	}
}

/**
 * Get model configuration from session environment or fall back to defaults
 * @param {Object} [session] - Session object from MCP containing environment variables
 * @param {Object} [defaults] - Default model configuration to use if not in session
 * @returns {Object} Model configuration with model, maxTokens, and temperature
 */
export function getModelConfig(session, defaults = DEFAULT_MODEL_CONFIG) {
	// Get values from session or fall back to defaults
	return {
		model: session?.env?.MODEL || defaults.model,
		maxTokens: parseInt(session?.env?.MAX_TOKENS || defaults.maxTokens),
		temperature: parseFloat(session?.env?.TEMPERATURE || defaults.temperature)
	};
}

/**
 * Returns the best available AI model based on specified options
 * @param {Object} session - Session object from MCP containing environment variables
 * @param {Object} options - Options for model selection
 * @param {boolean} [options.requiresResearch=false] - Whether the operation requires research capabilities
 * @param {boolean} [options.claudeOverloaded=false] - Whether Claude is currently overloaded
 * @param {Object} [log] - Logger object to use (defaults to console)
 * @returns {Promise<Object>} Selected model info with type and client
 * @throws {Error} If no AI models are available
 */
export async function getBestAvailableAIModel(
	session,
	options = {},
	log = console
) {
	const { requiresResearch = false, claudeOverloaded = false } = options;

	// Check if Anthropic API key is available (now used for OpenRouter)
	if (session?.env?.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY) {
		try {
			const client = getAnthropicClientForMCP(session, log);
			
			// Select the appropriate model based on requirements
			let modelName = 'anthropic/claude-3.7-sonnet'; // Default model
			
			if (requiresResearch) {
				// For research tasks, prefer a larger model
				modelName = 'anthropic/claude-3.7-sonnet';
			}
			
			if (claudeOverloaded) {
				// If Claude is overloaded, try another model through OpenRouter
				log.warn('Claude appears to be overloaded, using alternative model');
				modelName = 'openai/gpt-4o'; // Alternative model
			}
			
			return { 
				type: 'claude',
				client, 
				modelName 
			};
		} catch (error) {
			log.error(`OpenRouter not available: ${error.message}`);
			// Fall through to Perplexity as backup if available
		}
	}

	// Fallback to Perplexity for research if OpenRouter is not available
	if (
		requiresResearch &&
		(session?.env?.PERPLEXITY_API_KEY || process.env.PERPLEXITY_API_KEY)
	) {
		try {
			const client = await getPerplexityClientForMCP(session, log);
			return { type: 'perplexity', client };
		} catch (error) {
			log.warn(`Perplexity not available: ${error.message}`);
			// No more fallbacks available
		}
	}

	// If we got here, no models were successfully initialized
	throw new Error('No AI models available. Please check your API keys.');
}

/**
 * Handle OpenRouter API errors with user-friendly messages
 * @param {Error} error - The error from OpenRouter API
 * @returns {string} User-friendly error message
 */
export function handleClaudeError(error) {
	// Check for HTTP error status codes
	const statusCode = error?.status || error?.statusCode;
	if (statusCode) {
		switch (statusCode) {
			case 429:
				return 'Rate limit exceeded. Please wait a few minutes before making more requests.';
			case 402:
				return 'Insufficient credits. Please add more credits to your OpenRouter account.';
			case 404:
				return 'Model not found. Please check the model name.';
			case 400:
				return 'Bad request. Please check your request parameters.';
			case 401:
				return 'Authentication error. Please check your API key.';
			case 500:
				return 'OpenRouter server error. Please try again later.';
			default:
				return `OpenRouter API error (${statusCode}): ${error.message}`;
		}
	}

	// Check for network/timeout errors
	if (error.message?.toLowerCase().includes('timeout')) {
		return 'The request to OpenRouter timed out. Please try again.';
	}
	if (error.message?.toLowerCase().includes('network')) {
		return 'There was a network error connecting to OpenRouter. Please check your internet connection and try again.';
	}

	// Default error message
	return `Error communicating with OpenRouter: ${error.message}`;
}
