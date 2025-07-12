# This script analyzes the dependencies between files in the modules directory and suggests a porting order.
# python3 analyze_imports.py modules
# python3 analyze_imports.py modules --check-only

import os
import re
import sys
from collections import defaultdict
from pathlib import Path

def extract_imports(file_path):
    with open(file_path, 'r') as f:
        content = f.read()
    # Match import statements like 'import { ... } from "./foo"' or 'import { ... } from "../foo"'
    imports = re.findall(r'import\s+.*?from\s+[\'"]([^\'"]+)[\'"]', content)
    # Keep all relative imports (both ./ and ../)
    return [imp for imp in imports if imp.startswith('.')]

def resolve_import_path(import_path, current_file_path, base_dir):
    """Resolve an import path to the actual file path."""
    current_dir = os.path.dirname(current_file_path)
    
    # Handle relative imports
    if import_path.startswith('./'):
        # Same directory
        target_file = os.path.join(current_dir, import_path[2:] + '.ts')
    elif import_path.startswith('../'):
        # Parent directory
        target_file = os.path.join(current_dir, import_path + '.ts')
    else:
        return None
    
    # Normalize the path
    target_file = os.path.normpath(target_file)
    
    # Check if the file exists
    if os.path.exists(target_file):
        return target_file
    
    return None

def build_dependency_graph(directory):
    graph = defaultdict(set)
    files = {}
    file_sizes = {}
    module_files = defaultdict(list)
    
    # First pass: collect all .ts files recursively
    for root, dirs, filenames in os.walk(directory):
        for filename in filenames:
            if filename.endswith('.ts'):
                file_path = os.path.join(root, filename)
                rel_path = os.path.relpath(file_path, directory)
                module_name = os.path.splitext(rel_path)[0].replace(os.sep, '/')
                
                files[module_name] = file_path
                file_sizes[module_name] = os.path.getsize(file_path)
                
                # Organize by module directory
                module_dir = os.path.dirname(rel_path)
                if module_dir == '.':
                    module_dir = ''
                module_files[module_dir].append(module_name)
    
    # Second pass: build dependency graph
    for module_name, file_path in files.items():
        imports = extract_imports(file_path)
        for imp in imports:
            resolved_path = resolve_import_path(imp, file_path, directory)
            if resolved_path and resolved_path in files.values():
                # Find the module name for the resolved path
                for name, path in files.items():
                    if path == resolved_path:
                        graph[module_name].add(name)
                        break
    
    return graph, file_sizes, module_files

def find_cycle(graph, start, visited, path):
    """Find a cycle in the graph starting from 'start' node."""
    if start in path:
        cycle_start = path.index(start)
        return path[cycle_start:] + [start]
    
    if start in visited:
        return None
    
    visited.add(start)
    path.append(start)
    
    for neighbor in graph.get(start, set()):
        cycle = find_cycle(graph, neighbor, visited, path)
        if cycle:
            return cycle
    
    path.pop()
    return None

def check_circular_dependencies(graph):
    """Check for circular dependencies and return any found cycles."""
    cycles = []
    visited = set()
    
    for node in graph.keys():
        if node not in visited:
            cycle = find_cycle(graph, node, set(), [])
            if cycle:
                cycles.append(cycle)
                # Mark all nodes in the cycle as visited to avoid duplicate cycles
                visited.update(cycle)
    
    return cycles

def topological_sort(graph, file_sizes):
    visited = set()
    temp = set()
    order = []

    def visit(node):
        if node in temp:
            # Found a cycle, let's find and print it
            cycle = find_cycle(graph, node, set(), [])
            if cycle:
                print(f"\nCircular dependency found:")
                print(" -> ".join(cycle))
            raise ValueError(f"Circular dependency detected involving {node}")
        if node in visited:
            return
        temp.add(node)
        for neighbor in graph.get(node, set()):
            visit(neighbor)
        temp.remove(node)
        visited.add(node)
        order.append(node)

    # Sort nodes to ensure consistent order
    # First sort by number of dependencies, then by file size
    nodes = sorted(graph.keys(), 
                  key=lambda x: (len(graph[x]), file_sizes[x]))
    
    for node in nodes:
        if node not in visited:
            visit(node)

    return order

def main():
    if len(sys.argv) < 2:
        print("Usage: python analyze_imports.py <modules_directory> [--check-only]")
        sys.exit(1)

    modules_dir = sys.argv[1]
    check_only = len(sys.argv) > 2 and sys.argv[2] == '--check-only'
    
    graph, file_sizes, module_files = build_dependency_graph(modules_dir)
    
    cycles = check_circular_dependencies(graph)
    if cycles:
        print("Circular dependencies found:")
        for i, cycle in enumerate(cycles, 1):
            print(f"{i}. {' -> '.join(cycle)}")
        sys.exit(1)

    if check_only:
        sys.exit(0)
    
    # Print dependency information
    print("\nDependencies for each file:")
    for file, deps in sorted(graph.items()):
        if deps:
            print(f"{file} depends on: {', '.join(sorted(deps))}")
        else:
            print(f"{file} has no dependencies")
    
    print("\nSuggested porting order:")
    try:
        order = topological_sort(graph, file_sizes)
        for i, file in enumerate(order, 1):
            print(f"{i}. {file}")
    except ValueError as e:
        print(f"\nError: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 