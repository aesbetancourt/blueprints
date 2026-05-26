import yaml from 'js-yaml';
import { XMLParser } from 'fast-xml-parser';
import Papa from 'papaparse';

export type DataFormat = 'json' | 'yaml' | 'xml' | 'csv';

/**
 * Detect format from file extension.
 */
export function detectFormat(filePath: string): DataFormat {
  const ext = filePath.split('.').pop()?.toLowerCase();
  if (ext === 'yaml' || ext === 'yml') return 'yaml';
  if (ext === 'xml') return 'xml';
  if (ext === 'csv') return 'csv';
  return 'json';
}

/**
 * Convert structured data from any supported format to a JSON string
 * suitable for jsoncrack-react visualization.
 * Returns null if parsing fails.
 */
export function toJson(content: string, format: DataFormat): string | null {
  try {
    switch (format) {
      case 'json':
        // Validate it's parseable
        JSON.parse(content);
        return content;

      case 'yaml': {
        const parsed = yaml.load(content);
        if (parsed === undefined || parsed === null) return '{}';
        return JSON.stringify(parsed, null, 2);
      }

      case 'xml': {
        const parser = new XMLParser({
          ignoreAttributes: false,
          attributeNamePrefix: '@_',
        });
        const parsed = parser.parse(content);
        if (!parsed || typeof parsed !== 'object') return null;
        return JSON.stringify(parsed, null, 2);
      }

      case 'csv': {
        const result = Papa.parse(content, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: true,
        });
        if (result.errors.length > 0 && result.data.length === 0) return '[]';
        return JSON.stringify(result.data, null, 2);
      }

      default:
        return null;
    }
  } catch {
    return null;
  }
}

/**
 * Validate content for a given format. Returns true if parseable.
 */
export function isValid(content: string, format: DataFormat): boolean {
  return toJson(content, format) !== null;
}
