

# Import Excel Data into Database

## Data Summary
The Excel contains 83 student records with instalment payment history. Classes range from 4th to 12th. Data includes student names, class, medium, total fees, up to 6 instalments, and balance.

## Data Cleaning Required
- **Cancelled students** (rows with "cancel" in balance/instalments): Import with `status: 'inactive'`
- **Combined payments** like "3000+1000" or "2000+3000": Parse and sum as single payment amount
- **Missing total_fees**: Calculate from sum of instalments where possible, or skip
- **Medium mapping**: "English Medium" → "English", "Marathi Medium" → "Marathi", "CBSE" → "CBSE", empty → "SSC"
- **Row 74 (Sibtan Khan)**: Has phone number in instalment column — skip payments, import student only
- **Missing class** (rows 81-83): Will be set to "Other"

## Approach
1. Copy Excel to `/tmp/`, parse with Python pandas
2. Generate SQL INSERT statements for `students` table (name, class, medium, total_fees, status)
3. Generate SQL INSERT statements for `payments` table (student_id, amount, payment_mode: 'cash', notes: 'Instalment X')
4. Use Supabase insert tool to execute the data import

## Technical Details

### Students table mapping
| Excel Column | DB Column |
|---|---|
| Name Of Students | name |
| Class | class |
| Medium | medium |
| Total fees | total_fees |
| Balance = "cancel" | status = 'inactive' |
| All others | status = 'active' |
| mobile | '0000000000' (not in Excel) |

### Payments table mapping
Each non-empty instalment column becomes a separate payment record linked to the student. Combined values like "3000+1000" are summed to a single payment of 4000.

### Script flow
1. Parse Excel with pandas
2. For each row: insert student via Supabase, get back the student ID
3. For each instalment: parse amount, insert payment linked to student ID
4. Skip rows/instalments with non-numeric or "cancel" values

No schema changes needed — existing tables support all fields.

