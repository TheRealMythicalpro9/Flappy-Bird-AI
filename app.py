from flask import Flask, send_from_directory, render_template_string

app = Flask(__name__, static_folder='static', static_url_path='/static')

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

if __name__ == '__main__':
    app.run(debug=True)
