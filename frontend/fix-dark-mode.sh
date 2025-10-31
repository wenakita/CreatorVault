#!/bin/bash

# Comprehensive Dark Mode Fix Script
# This script adds dark mode classes to all components that are missing them

echo "🌓 Starting Comprehensive Dark Mode Fix..."
echo ""

# Function to add dark mode to a component
fix_component() {
    local file=$1
    local name=$(basename "$file")
    
    echo "Fixing: $name"
    
    # Common patterns to fix
    sed -i 's/bg-white\([^-]\)/bg-white dark:bg-gray-900\1/g' "$file"
    sed -i 's/bg-gray-50\([^-]\)/bg-gray-50 dark:bg-gray-800\1/g' "$file"
    sed -i 's/bg-gray-100\([^-]\)/bg-gray-100 dark:bg-gray-800\1/g' "$file"
    sed -i 's/bg-gray-200\([^-]\)/bg-gray-200 dark:bg-gray-700\1/g' "$file"
    
    sed -i 's/text-gray-900\([^-]\)/text-gray-900 dark:text-gray-100\1/g' "$file"
    sed -i 's/text-gray-800\([^-]\)/text-gray-800 dark:text-gray-200\1/g' "$file"
    sed -i 's/text-gray-700\([^-]\)/text-gray-700 dark:text-gray-300\1/g' "$file"
    sed -i 's/text-gray-600\([^-]\)/text-gray-600 dark:text-gray-400\1/g' "$file"
    sed -i 's/text-gray-500\([^-]\)/text-gray-500 dark:text-gray-400\1/g' "$file"
    
    sed -i 's/border-gray-200\([^-]\)/border-gray-200 dark:border-gray-700\1/g' "$file"
    sed -i 's/border-gray-300\([^-]\)/border-gray-300 dark:border-gray-600\1/g' "$file"
    
    echo "  ✅ Fixed $name"
}

# Fix all component files
cd src/components

for file in *.tsx; do
    # Skip if already has good dark mode coverage
    dark_count=$(grep -c "dark:" "$file" 2>/dev/null || echo 0)
    
    if [ "$dark_count" -lt 5 ]; then
        fix_component "$file"
    else
        echo "Skipping: $file (already has $dark_count dark classes)"
    fi
done

echo ""
echo "🎉 Dark Mode Fix Complete!"
echo ""
echo "Next steps:"
echo "1. Review the changes: git diff"
echo "2. Test in the browser"
echo "3. Commit: git add -A && git commit -m 'fix: comprehensive dark mode'"

