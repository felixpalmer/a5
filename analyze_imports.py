# This script analyzes the dependencies between files in the core directory and suggests a porting order.
# python3 analyze_imports.py modules/core

import os
import re
import sys
from collections import defaultdict
from pathlib import Path

def extract_imports(file_path):
    with open(file_path, 'r') as f:
        content = f.read()
    # Match import statements like 'import { ... } from "./foo"'
    imports = re.findall(r'import\s+.*?from\s+[\'"]([^\'"]+)[\'"]', content)
    # Only keep relative imports
    return [imp for imp in imports if imp.startswith('.')]

def build_dependency_graph(directory):
    graph = defaultdict(set)
    files = {}
    file_sizes = {}
    
    # First pass: collect all .ts files
    for filename in os.listdir(directory):
        if filename.endswith('.ts'):
            file_path = os.path.join(directory, filename)
            module_name = os.path.splitext(filename)[0]
            files[module_name] = file_path
            file_sizes[module_name] = os.path.getsize(file_path)
    
    # Second pass: build dependency graph
    for module_name, file_path in files.items():
        imports = extract_imports(file_path)
        for imp in imports:
            # Get the base name of the imported file
            imp_base = os.path.splitext(os.path.basename(imp))[0]
            if imp_base in files:
                graph[module_name].add(imp_base)
    
    return graph, file_sizes

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
    if len(sys.argv) != 2:
        print("Usage: python analyze_imports.py <core_directory>")
        sys.exit(1)

    core_dir = sys.argv[1]
    graph, file_sizes = build_dependency_graph(core_dir)
    
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