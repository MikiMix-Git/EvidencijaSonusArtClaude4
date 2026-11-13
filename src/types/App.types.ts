export interface TextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName: string;
}

export interface PageData {
  pageNumber: number;
  text: string;
  items: TextItem[];
}

export interface PDFMetadata {
  title: string;
  author: string;
  subject: string;
  creator: string;
  producer: string;
  pageCount: number;
  fileSize: string;
  fileName: string;
}
