class Users < Application
  # provides :xml, :yaml, :js
  before :ensure_authenticated, :exclude => [:request_password, :reset_password]
  before :ensure_admin, :only => [:new, :create, :destroy, :index]
  before :load_user, :only => [:edit, :update, :show, :destroy, :settings] 
  before :load_users, :only => [:index, :create]
  before :load_clients_and_roles, :only => [:index, :create, :edit]
  before :check_authorization, :only => [:edit, :update, :show, :settings]

  def index
    @user = Employee.new
    display @users
  end

  def show
    display @user
  end

  def edit
    only_provides :html
    render
  end

  def create
    class_name = params[:user].delete(:class_name)
    @user = (class_name == "Employee" ? Employee : ClientUser).new(params[:user])
    #@user = User.new(params[:user])
    if @user.save
      redirect url(:user, @user)
    else
      render :index
    end
  end

  def update
    params[:user].delete(:class_name)
    if @user.update_attributes(params[:user]) || !@user.dirty?
      if current_user.is_admin?
        redirect url(:user, @user), :message => { :notice => "User has been updated" }
      else
        redirect url(:activities), :message => { :notice => "Your account information has been updated" }
      end
    else
      render(current_user.is_admin? ? :edit : :settings)
    end
  end

  def destroy
    if @user.destroy
      render_success
    else
      render_failure "Couldn't delete user which has activities"
    end
  end
  
  def settings
    render
  end

  # Returns all users matching current selected roles
  def with_roles
    raise Forbidden unless current_user.is_admin? || current_user.is_client_user?
    only_provides :json
    @search_criteria = SearchCriteria.new(params[:search_criteria], current_user)
    display @search_criteria.all_users.map { |u| { :id => u.id, :name => u.name } }
  end
  
  def request_password
    if params[:email]
      user = User.first(:email => params[:email])
      if user
        user.generate_password_reset_token
        redirect url(:login), :message => { :notice => "Email with password reset link has been sent to #{params[:email]}" }
      else
        redirect url(:request_password), :message => { :error => "Couldn't find user with email #{params[:email]}" }
      end
    else
      render
    end
  end
  
  def reset_password
    token = params[:token] or raise BadRequest
    user = User.first(:password_reset_token => token) or raise NotFound
    if user.password_reset_token_exp < DateTime.now
      redirect url(:password_reset), :message => { :notice => "Password reset token has expired" }
    else
      session.user = user
      user.clear_password_reset_token!
      redirect url(:settings, user.id), :message => { :notice => "Please set your password" }
    end
  end
  
  # this is for API, to let the client check if credentials are correct
  def authenticate
    provides :json
    display current_user.id
  end
    
  
protected

  def load_users
    @users = User.all(:order => [:name])
  end
  
  def load_user
    raise NotFound unless @user = User.get(params[:id]) 
  end
  
  def load_clients_and_roles
    @clients = Client.active.all(:order => [:name])
    @roles = Role.all(:order => [:name])
  end

  def check_authorization
    raise Forbidden unless @user.editable_by?(current_user)
  end
  
  def number_of_columns
    params[:action] == "show" || params[:action] == "settings" || params[:action] == "edit" ? 1 : super
  end
end # Users
