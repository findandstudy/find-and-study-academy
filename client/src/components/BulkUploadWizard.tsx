import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useMutation } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Download, Upload, FileSpreadsheet, CheckCircle, AlertCircle, ArrowLeft, ArrowRight } from 'lucide-react';

const COLUMNS = [
  'title', 'slug', 'description', 'content_type', 'status', 'section',
  'country_code', 'linked_quiz_slug', 'order', 'language', 'content_body_html',
  'video_url', 'document_url', 'image_url', 'alt_text', 'duration',
  'category_tag', 'display_name', 'file_size'
];

const REQUIRED = ['title', 'slug', 'content_type'];
const VALID_TYPES = ['lesson', 'video', 'image', 'document', 'quiz'];
const VALID_STATUSES = ['draft', 'published', 'archived'];
const VALID_LANGS = ['en', 'tr', 'ru', 'ar', 'az', 'fa', 'uz', 'kk', 'zh', 'es', 'fr'];

interface RowError { col: string; message: string }
interface ParsedRow { data: Record<string, string>; errors: RowError[]; selected: boolean }

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BulkUploadWizard({ open, onClose, onSuccess }: Props) {
  const [step, setStep] = useState(1);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importResult, setImportResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const importMutation = useMutation({
    mutationFn: async (validRows: Record<string, string>[]) =>
      apiRequest('POST', '/api/admin/content/bulk-import', { rows: validRows }),
    onSuccess: (data: any) => {
      setImportResult(data);
      setStep(4);
    },
    onError: () => {
      toast({ title: 'Import Failed', description: 'An error occurred during import.', variant: 'destructive' });
    },
  });

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const instructionData = [
      ['FIELD', 'REQUIRED', 'VALID VALUES', 'NOTES'],
      ['title', 'Yes', '', 'Content title'],
      ['slug', 'Yes', '', 'Unique URL slug (lowercase, hyphens)'],
      ['content_type', 'Yes', VALID_TYPES.join(', '), ''],
      ['status', 'No', VALID_STATUSES.join(', '), 'Default: draft'],
      ['language', 'No', VALID_LANGS.join(', '), 'Default: en'],
      ['country_code', 'No', '', 'ISO 2-letter country code'],
      ['section', 'No', '', 'e.g. A1, A2, A3'],
      ['order', 'No', '', 'Numeric order within section'],
      ['description', 'No', '', ''],
      ['content_body_html', 'No', '', 'HTML body for lessons'],
      ['video_url', 'No', '', 'YouTube/Vimeo URL for videos'],
      ['document_url', 'No', '', 'URL to downloadable file'],
      ['image_url', 'No', '', 'URL to image'],
      ['alt_text', 'No', '', 'Alt text for images'],
      ['duration', 'No', '', 'Video duration in seconds'],
      ['category_tag', 'No', '', 'Category for Partner Zone grouping'],
      ['display_name', 'No', '', 'Friendly display name for documents'],
      ['file_size', 'No', '', 'e.g. 2.3 MB'],
    ];
    const instrSheet = XLSX.utils.aoa_to_sheet(instructionData);
    XLSX.utils.book_append_sheet(wb, instrSheet, 'Instructions');

    const headerRow = [COLUMNS];
    const exampleRow = [
      'Example Lesson', 'example-lesson', 'An example lesson', 'lesson', 'draft', 'A1',
      'TR', '', '1', 'en', '<p>Content body here</p>',
      '', '', '', '', '', '', '', ''
    ];
    const dataSheet = XLSX.utils.aoa_to_sheet([...headerRow, exampleRow]);
    XLSX.utils.book_append_sheet(wb, dataSheet, 'Content');

    XLSX.writeFile(wb, 'content_bulk_template.xlsx');
  };

  const validateRow = (data: Record<string, string>): RowError[] => {
    const errors: RowError[] = [];
    for (const req of REQUIRED) {
      if (!data[req]?.trim()) errors.push({ col: req, message: `${req} is required` });
    }
    if (data.content_type && !VALID_TYPES.includes(data.content_type)) {
      errors.push({ col: 'content_type', message: `Invalid type: ${data.content_type}` });
    }
    if (data.status && !VALID_STATUSES.includes(data.status)) {
      errors.push({ col: 'status', message: `Invalid status: ${data.status}` });
    }
    if (data.language && !VALID_LANGS.includes(data.language)) {
      errors.push({ col: 'language', message: `Invalid language: ${data.language}` });
    }
    if (data.slug && !/^[a-z0-9][a-z0-9-_]*$/.test(data.slug)) {
      errors.push({ col: 'slug', message: 'Slug must be lowercase with hyphens/underscores only' });
    }
    return errors;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: 'binary' });
        const sheetName = wb.SheetNames.find(n => n !== 'Instructions') || wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });
        const parsed: ParsedRow[] = jsonData.map(row => ({
          data: row,
          errors: validateRow(row),
          selected: true,
        }));
        setRows(parsed);
        setStep(3);
      } catch (err) {
        toast({ title: 'Parse Error', description: 'Could not parse the uploaded file.', variant: 'destructive' });
      }
    };
    reader.readAsBinaryString(file);
  };

  const toggleRow = (idx: number) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, selected: !r.selected } : r));
  };

  const handleImport = () => {
    const validSelected = rows.filter(r => r.selected && r.errors.length === 0).map(r => r.data);
    if (validSelected.length === 0) {
      toast({ title: 'Nothing to import', description: 'Select at least one valid row.', variant: 'destructive' });
      return;
    }
    importMutation.mutate(validSelected);
  };

  const handleClose = () => {
    setStep(1);
    setRows([]);
    setImportResult(null);
    onClose();
  };

  const validCount = rows.filter(r => r.errors.length === 0).length;
  const selectedValid = rows.filter(r => r.selected && r.errors.length === 0).length;
  const invalidCount = rows.filter(r => r.errors.length > 0).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Bulk Content Upload
          </DialogTitle>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-2 mb-4">
          {['Download Template', 'Upload File', 'Preview & Validate', 'Import'].map((label, idx) => (
            <div key={label} className="flex items-center gap-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 
                ${step > idx + 1 ? 'bg-primary border-primary text-primary-foreground' 
                : step === idx + 1 ? 'border-primary text-primary' 
                : 'border-muted text-muted-foreground'}`}>
                {step > idx + 1 ? <CheckCircle className="w-4 h-4" /> : idx + 1}
              </div>
              <span className={`text-xs ${step === idx + 1 ? 'text-primary font-medium' : 'text-muted-foreground'} hidden sm:inline`}>
                {label}
              </span>
              {idx < 3 && <div className="w-4 h-px bg-border" />}
            </div>
          ))}
        </div>

        {/* Step 1: Download Template */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="p-4 rounded-md bg-muted/50 border text-sm space-y-2">
              <p className="font-medium">Before uploading, download the Excel template:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Fill in the <strong>Content</strong> sheet with your data</li>
                <li>See the <strong>Instructions</strong> sheet for field descriptions</li>
                <li>Required fields: title, slug, content_type</li>
                <li>Upsert by slug — existing records will be updated</li>
              </ul>
            </div>
            <Button onClick={downloadTemplate} className="w-full" data-testid="button-download-template">
              <Download className="w-4 h-4 mr-2" />
              Download Excel Template
            </Button>
            <Button variant="outline" className="w-full" onClick={() => setStep(2)}>
              Skip — I already have the template
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {/* Step 2: Upload File */}
        {step === 2 && (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover-elevate"
              onClick={() => fileInputRef.current?.click()}
              data-testid="dropzone-upload"
            >
              <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              <p className="font-medium">Click to upload XLSX or CSV file</p>
              <p className="text-sm text-muted-foreground mt-1">Max 10 MB</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.csv,.xls"
                onChange={handleFileUpload}
                className="hidden"
                data-testid="input-file-upload"
              />
            </div>
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>
          </div>
        )}

        {/* Step 3: Preview & Validate */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex gap-3 flex-wrap">
              <Badge variant="default">{rows.length} rows total</Badge>
              <Badge variant="secondary">{validCount} valid</Badge>
              {invalidCount > 0 && <Badge variant="destructive">{invalidCount} with errors</Badge>}
              <Badge variant="outline">{selectedValid} selected for import</Badge>
            </div>
            <div className="overflow-x-auto max-h-[40vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">Select</TableHead>
                    <TableHead>Row</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Errors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, idx) => (
                    <TableRow
                      key={idx}
                      className={row.errors.length > 0 ? 'bg-destructive/5' : ''}
                      data-testid={`row-preview-${idx}`}
                    >
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={row.selected && row.errors.length === 0}
                          onChange={() => row.errors.length === 0 && toggleRow(idx)}
                          disabled={row.errors.length > 0}
                          data-testid={`checkbox-row-${idx}`}
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                      <TableCell className="text-sm max-w-[150px] truncate">{row.data.title}</TableCell>
                      <TableCell className="text-xs font-mono">{row.data.slug}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{row.data.content_type}</Badge></TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">{row.data.status || 'draft'}</Badge></TableCell>
                      <TableCell>
                        {row.errors.length > 0 ? (
                          <div className="text-xs text-destructive space-y-0.5">
                            {row.errors.map((e, ei) => (
                              <div key={ei} className="flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> {e.message}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <Button
                onClick={handleImport}
                disabled={selectedValid === 0 || importMutation.isPending}
                className="flex-1"
                data-testid="button-start-import"
              >
                {importMutation.isPending
                  ? 'Importing...'
                  : `Import ${selectedValid} rows`}
              </Button>
            </div>
            {importMutation.isPending && (
              <Progress value={undefined} className="w-full" />
            )}
          </div>
        )}

        {/* Step 4: Results */}
        {step === 4 && importResult && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">{importResult.created}</p>
                <p className="text-sm text-green-600 dark:text-green-500">Created</p>
              </div>
              <div className="text-center p-4 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{importResult.updated}</p>
                <p className="text-sm text-blue-600 dark:text-blue-500">Updated</p>
              </div>
              <div className="text-center p-4 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                <p className="text-2xl font-bold text-red-700 dark:text-red-400">{importResult.skipped}</p>
                <p className="text-sm text-red-600 dark:text-red-500">Skipped</p>
              </div>
            </div>
            {importResult.errors?.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Errors:</p>
                {importResult.errors.map((err: any, i: number) => (
                  <div key={i} className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                    Row {err.row}: {Array.isArray(err.errors) ? err.errors.join(', ') : err.errors}
                  </div>
                ))}
              </div>
            )}
            <Button className="w-full" onClick={() => { onSuccess(); handleClose(); }} data-testid="button-finish-import">
              <CheckCircle className="w-4 h-4 mr-2" />
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
