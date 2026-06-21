import urllib.request
import urllib.parse

url = 'https://www.quicklatex.com/latex3.f'

preamble = '''\\usepackage{amsmath}
\\usepackage{amsfonts}
\\usepackage{amssymb}
\\usepackage{circuitikz}
\\usetikzlibrary{calc}'''

formula = '''\\begin{circuitikz}
\\draw (0,0) node[op amp] (op) {};
\\end{circuitikz}'''

data = {
    'formula': formula,
    'fsize': '20px',
    'fcolor': '000000',
    'mode': '0',
    'out': '1',
    'remhost': 'quicklatex.com',
    'preamble': preamble,
}

data_encoded = urllib.parse.urlencode(data).encode('utf-8')

try:
    req = urllib.request.Request(url, data=data_encoded)
    with urllib.request.urlopen(req) as response:
        result = response.read().decode('utf-8')
        print(result)
except Exception as e:
    print("Error:", e)
