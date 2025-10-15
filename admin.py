from flask import Blueprint, render_template, redirect, url_for, flash, request, abort, jsonify
from flask_login import login_required, current_user
from extensions import db
from models import User, Alert, Transaction, Admin
from functools import wraps
from datetime import datetime, timedelta
import bcrypt
from extensions import db, login_manager
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Blueprint Definition
admin_bp = Blueprint('admin', __name__, url_prefix='/admin')

# Decorators
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        logger.debug(f"Checking admin access for user: {current_user}")
        logger.debug(f"Is authenticated: {current_user.is_authenticated}")
        logger.debug(f"Is Admin instance: {isinstance(current_user, Admin)}")
        if not current_user.is_authenticated or not isinstance(current_user, Admin):
            flash('You do not have permission to access this page.', 'danger')
            logger.warning(f"Access denied for user: {current_user}, redirecting to login")
            return redirect(url_for('auth.admin_login'))
        return f(*args, **kwargs)
    return decorated_function

def super_admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or not isinstance(current_user, Admin) or not current_user.is_super_admin:
            flash('You do not have super admin permission to access this page.', 'danger')
            logger.warning(f"Super admin access denied for user: {current_user}")
            return redirect(url_for('auth.login'))
        return f(*args, **kwargs)
    return decorated_function

def sensitive_data_access_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or not isinstance(current_user, Admin) or not current_user.can_view_sensitive_data:
            flash('You do not have permission to view sensitive data.', 'danger')
            logger.warning(f"Sensitive data access denied for user: {current_user}")
            return redirect(url_for('admin.dashboard'))
        return f(*args, **kwargs)
    return decorated_function

# Routes
@admin_bp.route('/dashboard')
@login_required
@admin_required
def dashboard():
    logger.info(f"Accessing dashboard for user: {current_user.email}")
    try:
        # Flag high-risk transactions and create alerts
        high_risk_txns = Transaction.query.filter(Transaction.risk_level == 'High', Transaction.is_flagged == False).all()
        Transaction.query.filter_by(risk_level='High').update({'is_flagged': True})
        db.session.commit()

        for txn in high_risk_txns:
            txn.is_flagged = True
            if not any(alert.message.startswith(f"High risk transaction: {txn.transaction_id[:8]}") 
                      for alert in Alert.query.filter_by(user_id=txn.user_id).all()):
                alert = Alert(
                    user_id=txn.user_id,
                    message=f"High risk transaction: {txn.transaction_id[:8]}... (₹{txn.amount}) to {txn.recipient_upi}",
                    alert_type="fraud_alert",
                    priority="high"
                )
                db.session.add(alert)
        db.session.commit()

        # Get all transactions and flagged transactions
        all_transactions = Transaction.query.order_by(Transaction.timestamp.desc()).all()
        flagged_transactions_list = Transaction.query.filter_by(is_flagged=True).order_by(Transaction.timestamp.desc()).all()

        # Get recent alerts (prioritize unread, then fill with read if needed)
        recent_alerts = Alert.query.filter_by(is_read=False).order_by(Alert.timestamp.desc()).limit(10).all()
        if len(recent_alerts) < 10:
            additional_alerts = Alert.query.filter_by(is_read=True).order_by(Alert.timestamp.desc()).limit(10 - len(recent_alerts)).all()
            recent_alerts.extend(additional_alerts)

        # Calculate stats for all users
        stats = {
            'total_users': User.query.count(),
            'new_users': User.query.filter(User.created_at >= (datetime.utcnow() - timedelta(days=7))).count(),
            'total_transactions': Transaction.query.count(),
            'flagged_transactions': len(flagged_transactions_list),
            'high_risk': Transaction.query.filter_by(risk_level='High').count(),
            'medium_risk': Transaction.query.filter_by(risk_level='Medium').count(),
            'low_risk': Transaction.query.filter_by(risk_level='Low').count(),
            'registered_emails': User.query.count(),
        }

        # Risk distribution for pie chart
        risk_distribution = {
            'low': stats['low_risk'],
            'medium': stats['medium_risk'],
            'high': stats['high_risk']
        }
        logger.debug(f"Risk Distribution: {risk_distribution}")

        # Monthly transaction data for line chart
        monthly_transactions = []
        current_date = datetime.utcnow()
        current_year = current_date.year
        first_day_of_year = datetime(current_year, 1, 1)

        for month in range(1, 13):
            month_start = datetime(current_year, month, 1)
            if month == 12:
                month_end = datetime(current_year + 1, 1, 1) - timedelta(seconds=1)
            else:
                month_end = datetime(current_year, month + 1, 1) - timedelta(seconds=1)
            
            count = Transaction.query.filter(
                Transaction.timestamp >= month_start,
                Transaction.timestamp <= month_end
            ).count()
            monthly_transactions.append(count)

        # Feature importance data
        feature_importance = {
            "transaction_amount": 0.35,
            "recipient_frequency": 0.25,
            "time_of_day": 0.20,
            "location_match": 0.15,
            "device_fingerprint": 0.05
        }

        # Calculate flagged transactions per user
        users = User.query.all()
        user_flagged_counts = {}
        for user in users:
            flagged_count = Transaction.query.filter_by(user_id=user.id, is_flagged=True).count()
            user_flagged_counts[user.username] = flagged_count

        # Get recent alerts for promoted users
        promoted_user_ids = [user.id for user in current_user.promoted_users]
        if promoted_user_ids:
            recent_alerts = Alert.query.filter(Alert.user_id.in_(promoted_user_ids)).order_by(Alert.timestamp.desc()).limit(10).all()
        else:
            recent_alerts = Alert.query.order_by(Alert.timestamp.desc()).limit(10).all()

        recent_users = User.query.order_by(User.created_at.desc()).limit(5).all()
        users = User.query.order_by(User.created_at.desc()).all()
        for user in users:
            user.transaction_count = Transaction.query.filter_by(user_id=user.id).count()

        current_year = datetime.utcnow().year
        logger.debug(f"Current Year: {current_year}")

        return render_template('admin_dashboard.html',
                             total_users=stats['total_users'],
                             total_transactions=stats['total_transactions'],
                             flagged_transactions=stats['flagged_transactions'],
                             flagged_transactions_list=flagged_transactions_list,
                             registered_emails=stats['registered_emails'],
                             high_risk=stats['high_risk'],
                             medium_risk=stats['medium_risk'],
                             low_risk=stats['low_risk'],
                             monthly_transactions=monthly_transactions,
                             risk_distribution=risk_distribution,
                             recent_alerts=recent_alerts,
                             recent_users=recent_users,
                             users=users,
                             user_flagged_counts=user_flagged_counts,
                             current_user=current_user,
                             all_transactions=all_transactions,
                             current_year=current_year,
                             feature_importance=feature_importance)
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating transactions: {str(e)}")
        flash('Error updating transaction status', 'danger')
        return render_template('admin_dashboard.html', **{key: 0 for key in [
            'total_users', 'total_transactions', 'flagged_transactions', 'registered_emails',
            'high_risk', 'medium_risk', 'low_risk'
        ]}, monthly_transactions=[0]*12, risk_distribution={'low': 0, 'medium': 0, 'high': 0}, 
        recent_alerts=[], feature_importance={})

@admin_bp.route('/dashboard-data')
@login_required
@admin_required
def dashboard_data():
    try:
        current_date = datetime.utcnow()
        current_year = current_date.year
        monthly_transactions = []
        
        for month in range(1, 13):
            month_start = datetime(current_year, month, 1)
            if month == 12:
                month_end = datetime(current_year + 1, 1, 1) - timedelta(seconds=1)
            else:
                month_end = datetime(current_year, month + 1, 1) - timedelta(seconds=1)
            
            count = Transaction.query.filter(
                Transaction.timestamp >= month_start,
                Transaction.timestamp <= month_end
            ).count()
            monthly_transactions.append(count)
        
        risk_distribution = {
            'low': Transaction.query.filter_by(risk_level='Low').count(),
            'medium': Transaction.query.filter_by(risk_level='Medium').count(),
            'high': Transaction.query.filter_by(risk_level='High').count()
        }
        
        return jsonify({
            'monthlyTransactions': monthly_transactions,
            'riskDistribution': risk_distribution,
            'total': Transaction.query.count(),
            'flagged': Transaction.query.filter_by(is_flagged=True).count()
        })
    except Exception as e:
        logger.error(f"Error fetching dashboard data: {str(e)}")
        return jsonify({'error': 'Failed to fetch data'}), 500

@admin_bp.route('/user/dashboard-data')
@login_required
@admin_required
def user_dashboard_data():
    try:
        risk_distribution = {
            'low': Transaction.query.filter_by(risk_level='Low').count(),
            'medium': Transaction.query.filter_by(risk_level='Medium').count(),
            'high': Transaction.query.filter_by(risk_level='High').count()
        }
        return jsonify({
            'success': True,
            'riskDistribution': risk_distribution
        })
    except Exception as e:
        logger.error(f"Error fetching user dashboard data: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Failed to load dashboard data: {str(e)}'
        }), 500

@admin_bp.route('/mark_all_read', methods=['POST'])
@login_required
@admin_required
def mark_all_read():
    Alert.query.update({'is_read': True})
    db.session.commit()
    flash('All alerts marked as read', 'success')
    return redirect(url_for('admin.dashboard'))

@admin_bp.route('/flagged-transactions')
@login_required
@admin_required
def flagged_transactions():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    
    flagged_txns = Transaction.query.filter_by(is_flagged=True).order_by(Transaction.timestamp.desc()).paginate(page=page, per_page=per_page)
    
    return render_template('admin_dashboard.html', 
                         flagged_transactions_list=flagged_txns.items,
                         pagination=flagged_txns)

@admin_bp.route('/unflag-transaction/<int:txn_id>', methods=['POST'])
@login_required
@admin_required
def unflag_transaction(txn_id):
    txn = Transaction.query.get_or_404(txn_id)
    try:
        txn.is_flagged = False
        db.session.commit()
        flash('Transaction unflagged successfully', 'success')
    except Exception as e:
        db.session.rollback()
        flash(f'Error unflagging transaction: {str(e)}', 'danger')
    
    return redirect(url_for('admin.dashboard'))

@admin_bp.route('/delete-transaction/<int:txn_id>', methods=['POST'])
@login_required
@admin_required
def delete_transaction(txn_id):
    txn = Transaction.query.get_or_404(txn_id)
    try:
        db.session.delete(txn)
        db.session.commit()
        flash('Transaction deleted successfully', 'success')
    except Exception as e:
        db.session.rollback()
        flash(f'Error deleting transaction: {str(e)}', 'danger')
    
    return redirect(url_for('admin.dashboard'))

@admin_bp.route('/flag-transaction/<int:txn_id>', methods=['POST'])
@login_required
@admin_required
def flag_transaction(txn_id):
    txn = Transaction.query.get_or_404(txn_id)
    try:
        txn.is_flagged = True
        txn.flagged_by_id = current_user.id
        db.session.commit()
        flash('Transaction flagged successfully', 'success')
    except Exception as e:
        db.session.rollback()
        flash(f'Error flagging transaction: {str(e)}', 'danger')
    return redirect(url_for('admin.dashboard'))

@admin_bp.route('/delete_user/<int:user_id>', methods=['POST'])
@login_required
@admin_required
def delete_user(user_id):
    user = User.query.get_or_404(user_id)
    
    if user.id == current_user.id:
        logger.warning(f"Admin {current_user.email} attempted to delete their own account")
        flash('You cannot delete your own account.', 'danger')
        return redirect(url_for('admin.dashboard'))
    
    try:
        db.session.delete(user)
        db.session.commit()
        logger.info(f"User {user.email} deleted by admin {current_user.email}")
        flash(f'User {user.email} and all associated data deleted successfully', 'success')
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting user {user.email}: {str(e)}")
        flash(f'Error deleting user: {str(e)}', 'danger')
    
    return redirect(url_for('admin.dashboard'))

@admin_bp.route('/users')
@login_required
@admin_required
def user_management():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    search = request.args.get('search', '').strip()
    
    query = User.query
    
    if search:
        query = query.filter(
            (User.username.ilike(f'%{search}%')) |
            (User.email.ilike(f'%{search}%'))
        )
    
    users = query.order_by(User.created_at.desc()).paginate(page=page, per_page=per_page)
    
    for user in users.items:
        user.transaction_count = Transaction.query.filter_by(user_id=user.id).count()
        high_risk = Transaction.query.filter_by(user_id=user.id, risk_level='High').count()
        medium_risk = Transaction.query.filter_by(user_id=user.id, risk_level='Medium').count()
        
        if high_risk > 3:
            user.risk_profile = 'high'
        elif medium_risk > 5 or high_risk > 0:
            user.risk_profile = 'medium'
        else:
            user.risk_profile = 'low'
    
    return render_template('admin_dashboard.html', users=users, search=search)

@admin_bp.route('/view-user-security/<int:user_id>')
@login_required
@admin_required
@sensitive_data_access_required
def view_user_security(user_id):
    user = User.query.get_or_404(user_id)
    
    try:
        return jsonify({
            'success': True,
            'username': user.username,
            'email': user.email,
            'created_at': user.created_at.strftime('%Y-%m-%d %H:%M') if user.created_at else 'Unknown',
            'last_login': user.last_login.strftime('%Y-%m-%d %H:%M') if user.last_login else 'Never logged in',
            'security_question': user.security_question or 'Not set',
            'security_answer': '********' if user.security_answer_hash else 'Not set',
            'password_hash': '********' if user.password_hash else 'Not set'
        })
    except Exception as e:
        logger.error(f"Error fetching security details for user {user_id}: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to load security details'
        }), 500

@admin_bp.route('/transactions')
@login_required
@admin_required
def transaction_management():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    risk_level = request.args.get('risk_level', 'all')
    user_id = request.args.get('user_id', type=int)
    
    query = Transaction.query
    
    if risk_level != 'all':
        query = query.filter_by(risk_level=risk_level.capitalize())
    
    if user_id:
        query = query.filter_by(user_id=user_id)
    
    transactions = query.order_by(Transaction.timestamp.desc()).paginate(page=page, per_page=per_page)
    
    return render_template('admin_dashboard.html', transactions=transactions)

@admin_bp.route('/create-admin', methods=['POST'])
@login_required
@admin_required
def create_admin():
    email = request.form.get('email')
    logger.debug(f"Attempting to create admin for email: {email}")
    user = User.query.filter_by(email=email).first()
    if not user:
        logger.error(f"No user found with email: {email}")
        flash('No user found with this email', 'danger')
        return redirect(url_for('admin.dashboard'))
    
    existing_admin = Admin.query.filter_by(email=email).first()
    if existing_admin:
        logger.warning(f"Admin already exists for email: {email}")
        flash('This user is already an admin', 'warning')
        return redirect(url_for('admin.dashboard'))
    
    new_admin = Admin(
        username=user.username,
        email=user.email,
        is_super_admin=False,
        created_by=current_user.id,
        can_view_sensitive_data=True,
        security_question=user.security_question,
        security_answer_hash=user.security_answer_hash
    )
    new_admin.password_hash = user.password_hash
    
    try:
        db.session.add(new_admin)
        db.session.flush()
        user.promoted_by_id = new_admin.id
        db.session.commit()
        logger.info(f"Admin created successfully for email: {email}")
        flash(f'Successfully created admin account for {email}', 'success')
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating admin: {str(e)}")
        flash(f'Error creating admin: {str(e)}', 'danger')
    
    return redirect(url_for('admin.dashboard'))

@admin_bp.route('/promote-to-admin/<int:user_id>', methods=['POST'])
@login_required
@super_admin_required
def promote_to_admin(user_id):
    user = User.query.get_or_404(user_id)
    
    existing_admin = Admin.query.filter_by(email=user.email).first()
    if existing_admin:
        logger.warning(f"User {user.email} is already an admin")
        return jsonify({'success': False, 'message': 'User is already an admin'}), 400
    
    new_admin = Admin(
        username=user.username,
        email=user.email,
        is_super_admin=False,
        created_at=datetime.utcnow(),
        security_question=user.security_question,
        security_answer_hash=user.security_answer_hash,
        created_by=current_user.id,
        can_view_sensitive_data=True
    )
    new_admin.password_hash = user.password_hash
    
    try:
        db.session.add(new_admin)
        db.session.flush()
        user.promoted_by_id = new_admin.id
        db.session.commit()
        logger.info(f"User {user.email} promoted to admin")
        return jsonify({'success': True, 'message': 'User promoted to admin successfully'})
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error promoting user {user.email}: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@login_manager.user_loader
def load_user(user_id):
    print(f"Loading user with ID: {user_id}")
    admin = db.session.get(Admin, int(user_id))
    if admin:
        print(f"Loaded Admin: {admin.email}")
        return admin
    user = db.session.get(User, int(user_id))
    if user:
        print(f"Loaded User: {user.email}")
    return user
