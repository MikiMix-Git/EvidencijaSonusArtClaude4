import { PageData, PDFMetadata } from './App.types';
import { BankStatementSummary } from '../utils/BankStatementParser';

export interface BankStatement {
  id: string;
  fileName: string;
  uploadDate: Date;
  metadata: PDFMetadata;
  summary: BankStatementSummary;
  pages: PageData[];
}
