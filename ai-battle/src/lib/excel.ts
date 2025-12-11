import { Startup } from './types';

export interface ParsedStartup {
  name: string;
  description?: string;
}

export const parseFile = (file: File): Promise<ParsedStartup[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        
        if (!text || text.trim() === '') {
          console.log('Empty file');
          resolve([]);
          return;
        }
        
        // Split by newlines and filter empty lines
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
        
        if (lines.length === 0) {
          console.log('No lines found in file');
          resolve([]);
          return;
        }
        
        console.log('Lines found:', lines.length);
        console.log('First few lines:', lines.slice(0, 5));
        
        // Detect delimiter (comma, semicolon, or tab)
        const firstLine = lines[0];
        let delimiter = ',';
        if (firstLine.includes(';')) delimiter = ';';
        else if (firstLine.includes('\t')) delimiter = '\t';
        
        // Parse header row
        const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ''));
        console.log('Headers:', headers);
        
        // Find name column index
        const nameKeys = ['name', 'Name', 'NAME', 'Startup Name', 'startup name', 'Startup', 'startup', 'Company', 'company', 'COMPANY'];
        const descKeys = ['description', 'Description', 'DESCRIPTION', 'desc', 'Desc', 'DESC'];
        
        let nameIndex = -1;
        let descIndex = -1;
        
        for (let i = 0; i < headers.length; i++) {
          const header = headers[i];
          if (nameIndex === -1 && nameKeys.includes(header)) {
            nameIndex = i;
          }
          if (descIndex === -1 && descKeys.includes(header)) {
            descIndex = i;
          }
        }
        
        // If no name column found, use first column
        if (nameIndex === -1) {
          nameIndex = 0;
          console.log('No name column found, using first column');
        }
        
        // Parse data rows (skip header)
        const startups: ParsedStartup[] = [];
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(delimiter).map(v => v.trim().replace(/^["']|["']$/g, ''));
          const name = values[nameIndex] || '';
          const description = descIndex >= 0 ? (values[descIndex] || '') : '';
          
          if (name && name !== 'undefined') {
            startups.push({ name, description });
          }
        }
        
        console.log('Parsed startups:', startups);
        resolve(startups);
      } catch (error) {
        console.error('File parsing error:', error);
        reject(error);
      }
    };
    
    reader.onerror = (error) => reject(error);
    reader.readAsText(file);
  });
};
