import sys
import urllib.request
import urllib.parse
import os
import re

def verify_tikz(file_path):
    if not os.path.exists(file_path):
        print(f"Error: File '{file_path}' not found.")
        return False

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Try to extract the circuitikz environment
    match = re.search(r'\\begin{circuitikz}.*?\\end{circuitikz}', content, re.DOTALL)
    if match:
        formula = match.group(0)
    else:
        # If no explicit environment is found, wrap the whole file if it looks like tikz commands
        formula = f"\\begin{{circuitikz}}\n{content}\n\\end{{circuitikz}}"

    url = 'https://www.quicklatex.com/latex3.f'

    preamble = '''\\usepackage{amsmath}
\\usepackage{amsfonts}
\\usepackage{amssymb}
\\usepackage{circuitikz}
\\usetikzlibrary{calc}
\\tikzset{
    terminal/.style={draw, thick, minimum width=0.2cm, minimum height=0.15cm, fill=white, inner sep=0pt},
    comparator/.style={op amp}
}'''

    data = {
        'formula': formula,
        'fsize': '20px',
        'fcolor': '000000',
        'mode': '0', # 0 = regular latex mode
        'out': '1',  # 1 = image URL
        'remhost': 'quicklatex.com',
        'preamble': preamble,
    }

    data_encoded = urllib.parse.urlencode(data, quote_via=urllib.parse.quote).encode('utf-8')
    print(f"Submitting to QuickLaTeX...")

    try:
        req = urllib.request.Request(url, data=data_encoded)
        with urllib.request.urlopen(req) as response:
            result = response.read().decode('utf-8')
            
            lines = result.strip().replace('\r', '').split('\n')
            if lines[0] == '0':
                image_url = lines[1].split()[0]
                print(f"Success! Image generated at: {image_url}")
                
                # Change the extension from .png to .svg to get vector graphics
                svg_url = image_url.replace('.png', '.svg')
                print(f"Requesting SVG from: {svg_url}")
                
                output_filename = os.path.splitext(file_path)[0] + "_rendered.svg"
                urllib.request.urlretrieve(svg_url, output_filename)
                print(f"Image downloaded and saved to: {os.path.abspath(output_filename)}")
                print(f"Agent Action: You can now view this image or embed it in an artifact using: ![Rendered TikZ](file:///{os.path.abspath(output_filename).replace(os.sep, '/')})")
                return True
            else:
                print("Compilation Failed!")
                print("Error Details:")
                print('\n'.join(lines[1:]))
                return False
    except Exception as e:
        print("Network/API Error:", e)
        return False

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python verify_tikz.py <path_to_tikz_file.tikz>")
        sys.exit(1)
    
    file_path = sys.argv[1]
    verify_tikz(file_path)
